import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATED_PATH, TITLES_PATH, gitHub, serialiseTitles } from './github.mjs';
import { createSession, passwordMatches, sessionIsValid } from './session.mjs';

test('accepts only the exact password', () => {
  assert.equal(passwordMatches('open sesame', 'open sesame'), true);
  assert.equal(passwordMatches('open sesam', 'open sesame'), false);
  assert.equal(passwordMatches('', 'open sesame'), false);
});

test('never accepts a login when no password is set', () => {
  assert.equal(passwordMatches('', ''), false);
  assert.equal(passwordMatches('anything', undefined), false);
  assert.equal(sessionIsValid('123.abc', undefined), false);
});

test('a fresh session is valid', () => {
  assert.equal(sessionIsValid(createSession('secret'), 'secret'), true);
});

test('a session stops working when it expires', () => {
  const token = createSession('secret', 0);
  assert.equal(sessionIsValid(token, 'secret', Date.now()), false);
});

test('a tampered or differently signed session is rejected', () => {
  const token = createSession('secret');
  const [expiry, signature] = token.split('.');
  assert.equal(sessionIsValid(`${Number(expiry) + 1000}.${signature}`, 'secret'), false);
  assert.equal(sessionIsValid(token, 'changed password'), false);
  assert.equal(sessionIsValid('garbage', 'secret'), false);
});

test('titles are written one per line', () => {
  const text = serialiseTitles([{ title: 'A' }, { title: 'B' }]);
  assert.equal(text, '[\n  {"title":"A"},\n  {"title":"B"}\n]\n');
  assert.deepEqual(JSON.parse(text), [{ title: 'A' }, { title: 'B' }]);
});

function fakeGitHub() {
  const calls = [];
  const replies = {
    'GET /git/ref/heads/main': { object: { sha: 'parent' } },
    'GET /git/commits/parent': { tree: { sha: 'base' } },
    'POST /git/trees': { sha: 'tree' },
    'POST /git/commits': { sha: 'commit' },
    'PATCH /git/refs/heads/main': {},
  };
  const fetcher = async (url, options = {}) => {
    const path = url.replace('https://api.github.com/repos/me/spectrum', '');
    const key = `${options.method ?? 'GET'} ${path}`;
    calls.push({ key, body: options.body && JSON.parse(options.body), auth: options.headers.Authorization });
    if (path.startsWith('/contents/')) {
      const content = path.includes('titles') ? '[{"title":"A"}]' : '{"x":1}';
      return { ok: true, json: async () => ({ content: Buffer.from(content).toString('base64') }) };
    }
    if (!(key in replies)) return { ok: false, status: 404 };
    return { ok: true, json: async () => replies[key] };
  };
  return { calls, store: gitHub({ token: 't0k', repo: 'me/spectrum', fetcher }) };
}

test('reads both data files from the repo', async () => {
  const { store } = fakeGitHub();
  assert.deepEqual(await store.read(), { titles: [{ title: 'A' }], generated: { x: 1 } });
});

test('saves both files in a single commit', async () => {
  const { calls, store } = fakeGitHub();
  const sha = await store.write({ titles: [{ title: 'B' }], generated: { y: 2 } }, 'Add B');
  assert.equal(sha, 'commit');
  const tree = calls.find((c) => c.key === 'POST /git/trees').body;
  assert.equal(tree.base_tree, 'base');
  assert.deepEqual(tree.tree.map((f) => f.path), [TITLES_PATH, GENERATED_PATH]);
  const commit = calls.find((c) => c.key === 'POST /git/commits').body;
  assert.deepEqual(commit, { message: 'Add B', tree: 'tree', parents: ['parent'] });
  assert.equal(calls.find((c) => c.key === 'PATCH /git/refs/heads/main').body.sha, 'commit');
  assert.ok(calls.every((c) => c.auth === 'Bearer t0k'));
});

test('stops with a clear error if GitHub refuses', async () => {
  const store = gitHub({ token: 't', repo: 'me/spectrum', fetcher: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(store.read(), /GitHub answered 401/);
});
