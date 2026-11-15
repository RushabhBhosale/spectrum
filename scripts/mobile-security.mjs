import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MOBILE_REDIRECT = 'memonest://movies';
export const MOBILE_SCOPES = ['library:read', 'titles:update'];
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const randomSecret = () => randomBytes(32).toString('hex');
export const challengeFor = (verifier) => createHash('sha256').update(verifier).digest('base64url');
export const credentialVersion = (password) => createHmac('sha256', password).update('spectrum-mobile-v1').digest('hex');
export const validVerifier = (value) => typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
export const validSecret = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function validateAuthorization(input) {
  if (input.redirectUri !== MOBILE_REDIRECT || input.method !== 'S256' ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.challenge || '') || !/^[a-f0-9]{64}$/.test(input.state || '')) {
    throw new Error('Invalid mobile authorization request. Start the connection again in Memonest.');
  }
  return { redirectUri: MOBILE_REDIRECT, method: 'S256', challenge: input.challenge, state: input.state };
}
export function equalSecret(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validateChanges(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Provide status or rating changes.');
  const fields = Object.keys(value);
  if (!fields.length || fields.some((key) => !['status', 'rating'].includes(key))) throw new Error('Only status and rating can be updated from Memonest.');
  if ('status' in value && !['Finished', 'Watching', 'On hold', 'Dropped', 'Unfinished'].includes(value.status)) throw new Error('Choose a supported viewing status.');
  if ('rating' in value && value.rating !== null && (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < 0 || value.rating > 10)) throw new Error('Ratings must be between 0 and 10.');
  return { ...('status' in value ? { status: value.status } : {}), ...('rating' in value ? { rating: value.rating } : {}) };
}
