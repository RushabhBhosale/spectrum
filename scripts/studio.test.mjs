import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATED_PATH, TITLES_PATH, gitHub, serialiseTitles } from './github.mjs';
import { fitRoster } from '../lib/roster.ts';
import { NO_FILTERS, RATING_OPTIONS, STATUS_OPTIONS, countWith, isFiltered, matches, sortTitles } from '../lib/title-list.ts';
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

const shelf = [
  { title: 'Alpha', type: 'Anime', rating: 10, hours: 12, year: 2001 },
  { title: 'beta', type: 'K-drama', rating: 8.5, status: 'Dropped', hours: 40, review: 'Lost me', year: 2020 },
  { title: 'Gamma', type: 'Anime', rating: null, status: 'Watched to season 3', hours: 30, quote: 'Go on' },
  { title: 'Delta', type: 'Hindi series', rating: 6, status: 'Watching', hours: 8, year: 2015 },
];
const names = (titles) => titles.map((title) => title.title);
const found = (change) => names(shelf.filter((title) => matches(title, { ...NO_FILTERS, ...change })));

test('filters by name, category, status, rating and notes together', () => {
  assert.deepEqual(found({ text: 'ALP' }), ['Alpha']);
  assert.deepEqual(found({ category: 'Anime' }), ['Alpha', 'Gamma']);
  assert.deepEqual(found({ status: 'Finished' }), ['Alpha']);
  assert.deepEqual(found({ status: 'Unfinished' }), ['Gamma']);
  assert.deepEqual(found({ rating: 'none' }), ['Gamma']);
  assert.deepEqual(found({ rating: '8' }), ['beta']);
  assert.deepEqual(found({ rating: 'low' }), ['Delta']);
  assert.deepEqual(found({ notes: 'quote' }), ['Gamma']);
  assert.deepEqual(found({ notes: 'no-review', category: 'Anime', rating: '10' }), ['Alpha']);
});

test('every title lands in exactly one status and one rating band', () => {
  for (const title of shelf) {
    assert.equal(STATUS_OPTIONS.filter((option) => option.test(title)).length, 1);
    assert.equal(RATING_OPTIONS.filter((option) => option.id !== '9' && option.test(title)).length, 1);
  }
});

test('a filter count respects the other filters', () => {
  assert.equal(countWith(shelf, { ...NO_FILTERS, category: 'Anime' }, { rating: 'none' }), 1);
  assert.equal(countWith(shelf, { ...NO_FILTERS, category: 'Anime' }, { category: '' }), 4);
});

test('knows when anything is filtered', () => {
  assert.equal(isFiltered(NO_FILTERS), false);
  assert.equal(isFiltered({ ...NO_FILTERS, text: '   ' }), false);
  assert.equal(isFiltered({ ...NO_FILTERS, rating: '10' }), true);
});

test('sorts without touching the original list', () => {
  const before = names(shelf);
  assert.deepEqual(names(sortTitles(shelf, 'added')), ['Alpha', 'beta', 'Gamma', 'Delta']);
  assert.deepEqual(names(sortTitles(shelf, 'name')), ['Alpha', 'beta', 'Delta', 'Gamma']);
  assert.deepEqual(names(sortTitles(shelf, 'name-reverse')), ['Gamma', 'Delta', 'beta', 'Alpha']);
  assert.deepEqual(names(sortTitles(shelf, 'hours')), ['beta', 'Gamma', 'Alpha', 'Delta']);
  assert.deepEqual(names(shelf), before);
});

test('titles missing a value sort last in both directions', () => {
  assert.deepEqual(names(sortTitles(shelf, 'rating-high')), ['Alpha', 'beta', 'Delta', 'Gamma']);
  assert.deepEqual(names(sortTitles(shelf, 'rating-low')), ['Delta', 'beta', 'Alpha', 'Gamma']);
  assert.deepEqual(names(sortTitles(shelf, 'year-new')), ['beta', 'Delta', 'Alpha', 'Gamma']);
  assert.deepEqual(names(sortTitles(shelf, 'year-old')), ['Alpha', 'Delta', 'beta', 'Gamma']);
});

test('the roster always fits on screen, however many titles there are', () => {
  for (const count of [1, 20, 21, 60, 150]) {
    const { columns, card } = fitRoster(count, 900, 680, 10);
    const rows = Math.ceil(count / columns);
    assert.ok(card > 0);
    assert.ok(columns * card + (columns - 1) * 10 <= 900);
    assert.ok(rows * card * 1.5 + (rows - 1) * 10 <= 680);
  }
});

test('the roster gets the biggest posters it can', () => {
  assert.equal(fitRoster(20, 900, 680, 10).columns, 7);
  assert.ok(fitRoster(20, 900, 680, 10).card > fitRoster(60, 900, 680, 10).card);
});
