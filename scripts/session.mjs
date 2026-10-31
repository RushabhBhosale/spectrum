// Password check and signed session cookie for the private studio page.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

const digest = (text) => createHash('sha256').update(text).digest();
const sign = (expiry, secret) => createHmac('sha256', secret).update(String(expiry)).digest('hex');

export function passwordMatches(attempt, password) {
  if (!password) return false;
  return timingSafeEqual(digest(attempt), digest(password));
}

export function createSession(password, now = Date.now()) {
  const expiry = now + SESSION_DAYS * DAY_MS;
  return `${expiry}.${sign(expiry, password)}`;
}

export function sessionIsValid(token, password, now = Date.now()) {
  if (!token || !password) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature || Number(expiry) < now) return false;
  const expected = Buffer.from(sign(expiry, password));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
