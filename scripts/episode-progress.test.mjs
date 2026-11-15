import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEpisodeGuide, countThroughEpisode } from '../lib/episode-progress.ts';
const rows = (counts) => counts.flatMap((count, index) => Array.from({ length: count }, (_, episode) => ({ season: index + 1, number: episode + 1 })));

test('House and Supernatural S5 E4 use their different real season lengths', () => {
  const house = buildEpisodeGuide(rows([22, 24, 24, 16, 4]), 'tvmaze');
  const supernatural = buildEpisodeGuide(rows([22, 22, 16, 22, 22]), 'tvmaze');
  assert.equal(countThroughEpisode(house, { season: 5, episode: 4 }), 90);
  assert.equal(countThroughEpisode(supernatural, { season: 5, episode: 4 }), 86);
  assert.equal(house.totalEpisodes, 90); // Only episodes through S5 E4 are needed for this fixture.
});
test('specials, duplicate catalog rows and unnumbered episodes do not inflate totals', () => {
  const guide = buildEpisodeGuide([{ season: 0, number: 1 }, { season: 1, number: null }, { season: 1, number: 1 }, { season: 1, number: 1 }, { season: 1, number: 3 }, { season: 2, number: 1 }], 'tvmaze');
  assert.equal(guide.totalEpisodes, 3);
  assert.equal(countThroughEpisode(guide, { season: 2, episode: 1 }), 3);
  assert.throws(() => countThroughEpisode(guide, { season: 1, episode: 2 }), /not in/);
});
test('invalid positions and incomplete earlier seasons are never guessed', () => {
  const guide = buildEpisodeGuide(rows([2, 3]), 'tvmaze');
  for (const position of [{ season: 0, episode: 1 }, { season: 1, episode: 0 }, { season: 1.5, episode: 1 }, { season: 4, episode: 1 }, { season: 2, episode: 4 }]) assert.throws(() => countThroughEpisode(guide, position));
  const missing = buildEpisodeGuide([{ season: 2, number: 1 }], 'tvmaze');
  assert.throws(() => countThroughEpisode(missing, { season: 2, episode: 1 }), /incomplete/);
});
