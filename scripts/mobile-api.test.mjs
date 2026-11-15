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
const episodeRoutes = await import('../app/api/mobile/episodes/route.ts');
const episodeMath = await import('../lib/episode-progress.ts');
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
test('preparing updates does not mutate the read snapshot', async () => {
  const original = store(); const snapshot = structuredClone(original); const title = domain.mobileTitle(original.titles[0], original);
  await domain.prepareMobileUpdate(original, title.id, title.revision, { status: 'On hold' }); assert.deepEqual(original, snapshot);
});

test('authenticated season progress resolves a count, persists both and keeps manual counts usable', async () => {
  globalThis.mobileTestStore = store();
  const rows = [2, 3, 1, 4, 5].flatMap((count, i) => Array.from({ length: count }, (_, number) => ({ season: i + 1, number: number + 1 })));
  const guide = episodeMath.buildEpisodeGuide(rows, 'tvmaze');
  globalThis.mobileTestStore.generated['Web series:A Show'].episodeGuide = guide;
  const session = await connect();
  const url = 'https://tracker.example/api/mobile/episodes?id=' + encodeURIComponent('Web series:A Show');
  assert.equal((await episodeRoutes.GET(new Request(url))).status, 401);
  assert.equal((await (await episodeRoutes.GET(new Request(url, { headers: { Authorization: `Bearer ${session.accessToken}` } }))).json()).totalEpisodes, 15);
  const current = domain.mobileTitle(globalThis.mobileTestStore.titles[0], globalThis.mobileTestStore);
  const response = await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: current.id, expectedRevision: current.revision, changes: { progress: { season: 5, episode: 4 }, episodes: 14 } }));
  assert.equal(response.status, 200);
  const saved = (await response.json()).title;
  assert.equal(saved.episodes, 14); assert.equal(saved.totalEpisodes, 15); assert.deepEqual(saved.progress, { season: 5, episode: 4 });
  assert.equal(globalThis.mobileTestStore.generated[saved.id].hours, 7);
  const manual = await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: saved.id, expectedRevision: saved.revision, changes: { episodes: 0 } }));
  assert.equal(manual.status, 200); const zero = (await manual.json()).title;
  assert.equal(zero.episodes, 0); assert.equal(zero.progress, null); assert.equal(globalThis.mobileTestStore.generated[saved.id].hours, 0);
});
test('episode API rejects invalid counts, movies, stale calculations and partial Finished progress', async () => {
  for (const changes of [{ episodes: -1 }, { episodes: 1.5 }, { episodes: '2' }, { episodes: null }, { progress: { season: 1 } }, { progress: { season: 0, episode: 1 } }]) assert.throws(() => validateChanges(changes));
  globalThis.mobileTestStore = store(); const session = await connect();
  const current = domain.mobileTitle(globalThis.mobileTestStore.titles[0], globalThis.mobileTestStore);
  for (const changes of [{ episodes: 21 }, { episodes: 2, status: 'Finished' }]) assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: current.id, expectedRevision: current.revision, changes }))).status, 400);
  const guide = episodeMath.buildEpisodeGuide(Array.from({ length: 20 }, (_, i) => ({ season: 1, number: i + 1 })), 'tvmaze');
  globalThis.mobileTestStore.generated[current.id].episodeGuide = guide;
  const revised = domain.mobileTitle(globalThis.mobileTestStore.titles[0], globalThis.mobileTestStore);
  assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: revised.id, expectedRevision: revised.revision, changes: { progress: { season: 1, episode: 4 }, episodes: 5 } }))).status, 409);
  assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: revised.id, expectedRevision: revised.revision, changes: { progress: { season: 1, episode: 99 } } }))).status, 400);
  globalThis.mobileTestStore.titles[0].tmdbKind = 'movie';
  const film = domain.mobileTitle(globalThis.mobileTestStore.titles[0], globalThis.mobileTestStore);
  assert.equal((await routes.PATCH(bearer(session.accessToken, 'PATCH', { id: film.id, expectedRevision: film.revision, changes: { episodes: 2 } }))).status, 400);
});


test('finished projections use known totals and preserve an explicit zero count', () => {
  const snapshot = store();
  snapshot.titles[0].status = undefined;
  delete snapshot.titles[0].episodes;
  assert.equal(domain.mobileTitle(snapshot.titles[0], snapshot).episodes, 20);
  snapshot.titles[0].episodes = 0;
  assert.equal(domain.mobileTitle(snapshot.titles[0], snapshot).episodes, 0);
});
