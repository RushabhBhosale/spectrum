import type { Collection, ObjectId } from 'mongodb';
import { trackerDatabase } from './store';
import { challengeFor, credentialVersion, hash, MOBILE_SCOPES, randomSecret, validSecret, validVerifier, validateAuthorization } from '@/scripts/mobile-security.mjs';

type Grant = {
  kind: 'code' | 'session';
  secretHash: string;
  credentialVersion: string;
  challenge?: string;
  createdAt: Date;
  expiresAt: Date;
  scopes: string[];
};
let indexed: Promise<unknown> | undefined;
async function grants(): Promise<Collection<Grant>> {
  if (!process.env.ADMIN_PASSWORD) throw new MobileError(503, 'Tracker sign-in is not configured.');
  const connected = await trackerDatabase();
  if (!connected) throw new MobileError(503, 'MongoDB is required for mobile connections.');
  const collection = connected.db.collection('mobile_grants') as Collection<Grant>;
  indexed ??= Promise.all([
    collection.createIndex({ secretHash: 1 }, { unique: true }),
    collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => { indexed = undefined; throw error; });
  await indexed;
  return collection;
}

export class MobileError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const version = () => credentialVersion(process.env.ADMIN_PASSWORD!);

export async function createMobileCode(input: Parameters<typeof validateAuthorization>[0]) {
  const request = validateAuthorization(input);
  const collection = await grants();
  const code = randomSecret();
  await collection.insertOne({ kind: 'code', secretHash: hash(code), challenge: request.challenge, credentialVersion: version(), createdAt: new Date(), expiresAt: new Date(Date.now() + 120_000), scopes: [...MOBILE_SCOPES] });
  const target = new URL(request.redirectUri);
  target.searchParams.set('code', code);
  target.searchParams.set('state', request.state);
  return target.toString();
}

export async function exchangeMobileCode(code: unknown, verifier: unknown) {
  if (!validSecret(code) || !validVerifier(verifier)) throw new MobileError(400, 'Invalid authorization exchange.');
  const collection = await grants();
  // Single-use, atomic consumption. A wrong verifier cannot consume someone else's code.
  const approved = await collection.findOneAndDelete({ kind: 'code', secretHash: hash(code as string), challenge: challengeFor(verifier as string), credentialVersion: version(), expiresAt: { $gt: new Date() } });
  if (!approved) throw new MobileError(401, 'Connection expired or was already used. Connect again.');
  const token = randomSecret();
  const expiresAt = new Date(Date.now() + 30 * 86_400_000);
  const saved = await collection.insertOne({ kind: 'session', secretHash: hash(token), credentialVersion: version(), createdAt: new Date(), expiresAt, scopes: approved.scopes });
  return { accessToken: token, connectionId: saved.insertedId.toHexString(), expiresAt: expiresAt.getTime(), scopes: approved.scopes, collectionId: 'personal' };
}

export async function requireMobileSession(request: Request, scope: string) {
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw new MobileError(401, 'Connect One More Episode in Memonest first.');
  const collection = await grants();
  const grant = await collection.findOne({ kind: 'session', secretHash: hash(token), credentialVersion: version(), expiresAt: { $gt: new Date() } });
  if (!grant) throw new MobileError(401, 'Tracker connection expired or was revoked. Connect again.');
  if (!grant.scopes.includes(scope)) throw new MobileError(403, 'This connection cannot perform that action.');
  return grant;
}

export async function revokeMobileSession(id: ObjectId) { await (await grants()).deleteOne({ _id: id, kind: 'session' }); }
export async function listMobileSessions() {
  return (await grants()).find({ kind: 'session', credentialVersion: version(), expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).toArray();
}

export function mobileResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer' } });
}
export function mobileFailure(error: unknown) {
  if (error instanceof MobileError) return mobileResponse({ error: error.message }, error.status);
  console.error('Mobile tracker request failed');
  return mobileResponse({ error: 'Tracker request failed. Please try again.' }, 503);
}
export async function mobileBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new MobileError(415, 'JSON required.');
  if (Number(request.headers.get('content-length') ?? 0) > 4096) throw new MobileError(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new MobileError(400, 'JSON request required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new MobileError(413, 'Request too large.'); }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new MobileError(400, 'Invalid JSON request.'); }
}
