import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { challengeFor, hash, MOBILE_REDIRECT, validateAuthorization, validateChanges } from './mobile-security.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mockStore = 'data:text/javascript,' + encodeURIComponent(`export async function trackerDatabase(){return {db:{collection:()=>globalThis.mobileTestGrants}}};export async function readStore(){return structuredClone(globalThis.mobileTestStore)};export async function writeStore(store){if(store.version!==globalThis.mobileTestStore.version)throw new Error('changed while you were editing');globalThis.mobileTestStore={...store,version:store.version+1}}`);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/store' || (specifier === './store' && context.parentURL?.includes('/lib/'))) return { url: mockStore, shortCircuit: true };
    let file;
    if (specifier.startsWith('@/')) file = resolve(root, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) file = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    if (file) { if (!existsSync(file) && existsSync(file + '.ts')) file += '.ts'; return next(pathToFileURL(file).href, context); }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'transform' }), shortCircuit: true };
    return next(url, context);
  },
});
let documents = [], sequence = 0;
const matches = (doc, filter) => Object.entries(filter).every(([key, value]) => value?.$gt ? doc[key] > value.$gt : String(doc[key]) === String(value));
globalThis.mobileTestGrants = {
  createIndex: async () => {},
  insertOne: async (doc) => { const serial = String(++sequence).padStart(24, '0'); const _id = { toHexString: () => serial, toString: () => serial }; documents.push({ ...doc, _id }); return { insertedId: _id }; },
  findOne: async (filter) => documents.find((doc) => matches(doc, filter)) ?? null,
  findOneAndDelete: async (filter) => { const i = documents.findIndex((doc) => matches(doc, filter)); return i < 0 ? null : documents.splice(i, 1)[0]; },
  deleteOne: async (filter) => { documents = documents.filter((doc) => !matches(doc, filter)); },
};
process.env.ADMIN_PASSWORD = 'unit-test-only-password';
const auth = await import('../lib/mobile-auth.ts');
const domain = await import('../lib/mobile-titles.ts');
const routes = await import('../app/api/mobile/titles/route.ts');
const verifier = 'v'.repeat(64);
const request = { challenge: challengeFor(verifier), method: 'S256', state: 'a'.repeat(64), redirectUri: MOBILE_REDIRECT };
const bearer = (token, method = 'GET', body) => new Request('https://tracker.example/api/mobile/titles', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
async function connect() { const callback = new URL(await auth.createMobileCode(request)); return auth.exchangeMobileCode(callback.searchParams.get('code'), verifier); }
const store = () => ({ version: 1, titles: [{ title: 'A Show', type: 'Web series', rating: 7, status: 'Watching', episodes: 3, quote: 'Keep this', review: 'Also keep this' }], generated: { 'Web series:A Show': { tmdbKind: 'tv', colours: ['#000000'], totalEpisodes: 20, runtimeMinutes: 30, hours: 2, year: 2024 } } });

test('authorization accepts only S256 and the exact app callback', () => {
  assert.equal(validateAuthorization(request).redirectUri, MOBILE_REDIRECT);
  for (const change of [{ redirectUri: 'https://evil.example' }, { method: 'plain' }, { challenge: 'short' }, { state: '' }]) assert.throws(() => validateAuthorization({ ...request, ...change }));
});
test('codes require the verifier, are single-use, and sessions store only hashes', async () => {
  const callback = new URL(await auth.createMobileCode(request)); const code = callback.searchParams.get('code');
  await assert.rejects(auth.exchangeMobileCode(code, 'x'.repeat(64)), /expired|used/);
  const session = await auth.exchangeMobileCode(code, verifier);
  await assert.rejects(auth.exchangeMobileCode(code, verifier), /expired|used/);
  assert.ok(session.connectionId);
  assert.ok(documents.some((doc) => doc.secretHash === hash(session.accessToken)));
  assert.ok(documents.every((doc) => !JSON.stringify(doc).includes(session.accessToken)));
  const grant = await auth.requireMobileSession(bearer(session.accessToken), 'titles:update');
  await auth.revokeMobileSession(grant._id);
  await assert.rejects(auth.requireMobileSession(bearer(session.accessToken), 'library:read'), /expired|revoked/);
});
test('password rotation and expiration invalidate credentials', async () => {
  const session = await connect(); process.env.ADMIN_PASSWORD = 'different-test-password';
  await assert.rejects(auth.requireMobileSession(bearer(session.accessToken), 'library:read'), /expired|revoked/);
  process.env.ADMIN_PASSWORD = 'unit-test-only-password';
  documents.find((doc) => doc.secretHash === hash(session.accessToken)).expiresAt = new Date(0);
  await assert.rejects(auth.requireMobileSession(bearer(session.accessToken), 'library:read'), /expired|revoked/);
});
test('API denies anonymous access and unsupported changes', async () => {
  assert.equal((await routes.GET(new Request('https://tracker.example/api/mobile/titles'))).status, 401);
  for (const changes of [{ title: 'Rename' }, { rating: '8.5' }, { rating: NaN }, { rating: 11 }, { status: 'Admin' }, {}]) assert.throws(() => validateChanges(changes));
  const session = await connect(); assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { admin: true }))).status, 400);
});
test('finished update reuses Studio rules, preserves metadata and rejects stale review', async () => {
  globalThis.mobileTestStore = store(); const original = structuredClone(globalThis.mobileTestStore); const session = await connect();
  const read = await routes.GET(bearer(session.accessToken)); assert.equal(read.headers.get('cache-control'), 'no-store');
  const title = (await read.json()).titles[0]; assert.equal('quote' in title, false); assert.equal('overview' in title, false);
  const changed = await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: title.id, expectedRevision: title.revision, changes: { status: 'Finished', rating: 8.5 } }));
  assert.equal(changed.status, 200); const saved = (await changed.json()).title; assert.equal(saved.status, 'Finished'); assert.equal(saved.rating, 8.5);
  const entry = globalThis.mobileTestStore.titles[0]; assert.equal(entry.status, undefined); assert.equal(entry.episodes, 20); assert.equal(entry.quote, original.titles[0].quote); assert.equal(entry.review, original.titles[0].review); assert.equal(globalThis.mobileTestStore.generated[title.id].hours, 10);
  assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: title.id, expectedRevision: title.revision, changes: { status: 'On hold' } }))).status, 409);
});
test('preparing updates does not mutate the read snapshot', () => {
  const original = store(); const snapshot = structuredClone(original); const title = domain.mobileTitle(original.titles[0], original);
  domain.prepareMobileUpdate(original, title.id, title.revision, { status: 'On hold' }); assert.deepEqual(original, snapshot);
});
