// Populate episode totals for finished TV series in the collection.
import { readFile, writeFile } from 'node:fs/promises';
import { client, pickMatch, runtimeHours } from './tmdb.mjs';

const TITLES = new URL('../data/titles.json', import.meta.url);
const GENERATED = new URL('../data/generated.json', import.meta.url);
const WORKERS = 8;
const key = process.env.TMDB_API_KEY;
if (!key) throw new Error('Add TMDB_API_KEY to .env first.');

const titles = JSON.parse(await readFile(TITLES, 'utf8'));
const generated = JSON.parse(await readFile(GENERATED, 'utf8'));
const get = client(key);
const queue = titles.filter((entry) => {
  const record = generated[`${entry.type}:${entry.title}`];
  const needsEpisodeTotal = (!entry.status || entry.status === 'Finished')
    && (record?.tmdbKind ?? entry.tmdbKind ?? 'tv') === 'tv'
    && !(record?.totalEpisodes ?? entry.totalEpisodes);
  return needsEpisodeTotal || !record?.overview;
});
const missing = [];
let updated = 0;

async function readTotal(entry) {
  const record = generated[`${entry.type}:${entry.title}`];
  let tmdbId = record?.tmdbId ?? entry.tmdbId;
  if (!tmdbId) {
    const { results = [] } = await get('/search/tv', { query: entry.title, include_adult: 'false' });
    tmdbId = pickMatch(results, entry.type)?.id;
  }
  if (!tmdbId) return null;
  const kind = record?.tmdbKind ?? entry.tmdbKind ?? 'tv';
  const detail = await get(`/${kind}/${tmdbId}`);
  const total = Number(detail.number_of_episodes);
  return {
    tmdbId,
    name: detail.name ?? detail.title,
    overview: typeof detail.overview === 'string' ? detail.overview.trim() : '',
    total: kind === 'tv' && Number.isSafeInteger(total) && total > 0 ? total : null,
    hours: kind === 'tv' && Number.isSafeInteger(total) && total > 0 ? runtimeHours(detail, 'tv', entry.type, total) : undefined,
  };
}

await Promise.all(Array.from({ length: WORKERS }, async () => {
  while (queue.length) {
    const entry = queue.shift();
    const key = `${entry.type}:${entry.title}`;
    try {
      const result = await readTotal(entry);
      if (!result) {
        missing.push(entry.title);
        continue;
      }
      const record = generated[key] ?? { tmdbKind: 'tv', hours: 0, colours: [] };
      if (result.overview) record.overview = result.overview;
      if (result.total) {
        entry.totalEpisodes = result.total;
        record.totalEpisodes = result.total;
        record.hours = result.hours;
        if (!entry.status || entry.status === 'Finished') {
          entry.episodes = result.total;
          entry.hours = result.hours;
        }
      }
      if (!record.tmdbId) {
        record.tmdbId = result.tmdbId;
        record.tmdbKind = record.tmdbKind ?? entry.tmdbKind ?? 'tv';
        record.tmdbName = result.name;
      }
      generated[key] = record;
      if (result.total || result.overview) updated++;
      if (updated % 20 === 0) console.log(`Updated ${updated} records...`);
    } catch (error) {
      missing.push(`${entry.title} (${error.message})`);
    }
  }
}));

await Promise.all([
  writeFile(TITLES, '[\n' + titles.map((entry) => '  ' + JSON.stringify(entry)).join(',\n') + '\n]\n'),
  writeFile(GENERATED, JSON.stringify(generated, null, 2) + '\n'),
]);
console.log(`Updated metadata for ${updated} titles.`);
if (missing.length) console.log(`No metadata retrieved for ${missing.length}:\n- ${missing.join('\n- ')}`);
