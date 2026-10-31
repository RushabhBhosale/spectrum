import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPalette, oklabToHex, rgbToOklab } from './palette.mjs';
import { chooseImages, chooseLogo, guessType, pickMatch, releaseYear, runtimeHours } from './tmdb.mjs';

const image = (...runs) => {
  const bytes = [];
  for (const [[r, g, b], count] of runs) for (let i = 0; i < count; i++) bytes.push(r, g, b);
  return Uint8Array.from(bytes);
};
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('hex colours survive the trip through OKLab', () => {
  assert.equal(oklabToHex(rgbToOklab(255, 91, 36)), '#ff5b24');
});

test('always returns seven valid colours', () => {
  const { colours, accent } = extractPalette(image([[200, 40, 40], 40]));
  assert.equal(colours.length, 7);
  for (const colour of [...colours, accent]) assert.match(colour, /^#[0-9a-f]{6}$/);
});

test('the accent comes from the larger of two vivid colours', () => {
  const { accent } = extractPalette(image([[220, 30, 30], 300], [[30, 60, 220], 100]));
  const [r, , b] = channels(accent);
  assert.ok(r > b);
});

test('a small vivid colour beats a big grey one', () => {
  const { accent } = extractPalette(image([[128, 128, 128], 800], [[255, 40, 0], 200]));
  const [r, g] = channels(accent);
  assert.ok(r > g + 100);
});

test('skin-beige stills still surface their accent colour', () => {
  const { accent } = extractPalette(image([[205, 180, 160], 850], [[60, 55, 50], 100], [[20, 90, 200], 50]));
  const [r, , b] = channels(accent);
  assert.ok(b > r);
});

test('stripes run from light to dark', () => {
  const { colours } = extractPalette(image([[240, 200, 60], 100], [[20, 60, 160], 100], [[200, 30, 80], 100], [[30, 20, 40], 100]));
  const lightness = colours.map((c) => rgbToOklab(...channels(c))[0]);
  for (let i = 1; i < lightness.length; i++) assert.ok(lightness[i] <= lightness[i - 1] + 0.001);
});

test('letterbox black is ignored', () => {
  const { colours, accent } = extractPalette(image([[0, 0, 0], 800], [[30, 160, 90], 200]));
  for (const colour of colours) assert.notEqual(colour, '#000000');
  assert.ok(channels(accent)[1] > 100);
});

test('a nearly black title stays dark', () => {
  const { accent } = extractPalette(image([[2, 2, 3], 1000]));
  assert.ok(Math.max(...channels(accent)) < 40);
});

test('the same pixels give the same colours', () => {
  const pixels = image([[10, 200, 120], 80], [[240, 180, 20], 60], [[90, 20, 160], 40]);
  assert.deepEqual(extractPalette(pixels), extractPalette(pixels));
});

test('matches a Korean original over an American remake', () => {
  const results = [
    { id: 1, original_language: 'en', genre_ids: [18] },
    { id: 2, original_language: 'ko', genre_ids: [18] },
  ];
  assert.equal(pickMatch(results, 'K-drama').id, 2);
});

test('anime must be animated', () => {
  const results = [
    { id: 1, original_language: 'ja', genre_ids: [18] },
    { id: 2, original_language: 'ja', genre_ids: [16] },
  ];
  assert.equal(pickMatch(results, 'Anime').id, 2);
  assert.equal(pickMatch([results[0]], 'Anime'), null);
});

test('donghua and Korean animation count as anime', () => {
  assert.equal(pickMatch([{ id: 3, original_language: 'zh', genre_ids: [16] }], 'Anime').id, 3);
  assert.equal(pickMatch([{ id: 4, original_language: 'ko', genre_ids: [16] }], 'Anime').id, 4);
});

test('J-drama and Hindi series match on language', () => {
  const results = [
    { id: 1, original_language: 'en' },
    { id: 2, original_language: 'ja' },
    { id: 3, original_language: 'hi' },
  ];
  assert.equal(pickMatch(results, 'J-drama').id, 2);
  assert.equal(pickMatch(results, 'Hindi series').id, 3);
});

test('web series take the first result in any language', () => {
  assert.equal(pickMatch([{ id: 7, original_language: 'de' }], 'Web series').id, 7);
});

test('guesses the category from language and genre', () => {
  assert.equal(guessType({ original_language: 'ja', genre_ids: [16] }), 'Anime');
  assert.equal(guessType({ original_language: 'zh', genre_ids: [16] }), 'Anime');
  assert.equal(guessType({ original_language: 'ja', genre_ids: [18] }), 'J-drama');
  assert.equal(guessType({ original_language: 'ko', genre_ids: [18] }), 'K-drama');
  assert.equal(guessType({ original_language: 'zh', genre_ids: [18] }), 'C-drama');
  assert.equal(guessType({ original_language: 'hi', genre_ids: [18] }), 'Hindi series');
  assert.equal(guessType({ original_language: 'en', genre_ids: [18] }), 'Web series');
});

test('hours use listed runtimes, then the last episode, then a typical length', () => {
  assert.equal(runtimeHours({ number_of_episodes: 10, episode_run_time: [60] }, 'tv', 'Web series'), 10);
  assert.equal(runtimeHours({ number_of_episodes: 6, episode_run_time: [], last_episode_to_air: { runtime: 30 } }, 'tv', 'Web series'), 3);
  assert.equal(runtimeHours({ number_of_episodes: 12, episode_run_time: [] }, 'tv', 'Anime'), 5);
  assert.equal(runtimeHours({ runtime: 125 }, 'movie', 'Anime'), 2);
});

test('hours follow the episodes actually watched', () => {
  assert.equal(runtimeHours({ number_of_episodes: 16, episode_run_time: [60] }, 'tv', 'K-drama', 8), 8);
});

test('reads the release year from shows and films', () => {
  assert.equal(releaseYear({ first_air_date: '2016-11-06' }), 2016);
  assert.equal(releaseYear({ release_date: '2019-05-30' }), 2019);
  assert.equal(releaseYear({ first_air_date: '' }), undefined);
});

test('picks an English PNG logo, then any PNG, then nothing', () => {
  const logos = [
    { file_path: '/ja.png', iso_639_1: 'ja', vote_count: 9 },
    { file_path: '/en.svg', iso_639_1: 'en', vote_count: 9 },
    { file_path: '/en.png', iso_639_1: 'en', vote_count: 1 },
  ];
  assert.equal(chooseLogo({ logos }), '/en.png');
  assert.equal(chooseLogo({ logos: logos.slice(0, 2) }), '/ja.png');
  assert.equal(chooseLogo({ logos: [logos[1]] }), null);
  assert.equal(chooseLogo({}), null);
});

test('prefers well-voted stills and falls back to the poster', () => {
  const images = { backdrops: [{ file_path: '/a', vote_count: 1 }, { file_path: '/b', vote_count: 9 }], posters: [{ file_path: '/p' }] };
  assert.deepEqual(chooseImages(images, 1), ['/b']);
  assert.deepEqual(chooseImages({ backdrops: [], posters: [{ file_path: '/p' }] }), ['/p']);
  assert.deepEqual(chooseImages({}), []);
});
