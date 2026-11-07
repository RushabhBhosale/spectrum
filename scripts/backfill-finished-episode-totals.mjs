// Reuse saved episode counts as totals for already-finished TV series.
import { readFile, writeFile } from 'node:fs/promises';

const TITLES = new URL('../data/titles.json', import.meta.url);
const GENERATED = new URL('../data/generated.json', import.meta.url);
const titles = JSON.parse(await readFile(TITLES, 'utf8'));
const generated = JSON.parse(await readFile(GENERATED, 'utf8'));
let updated = 0;
let unavailable = 0;

for (const entry of titles) {
  const key = `${entry.type}:${entry.title}`;
  const record = generated[key];
  const finished = !entry.status || entry.status === 'Finished';
  const isSeries = (record?.tmdbKind ?? entry.tmdbKind ?? 'tv') === 'tv';
  if (!finished || !isSeries || entry.totalEpisodes || record?.totalEpisodes) continue;
  if (Number.isSafeInteger(entry.episodes) && entry.episodes > 0) {
    entry.totalEpisodes = entry.episodes;
    if (record) record.totalEpisodes = entry.episodes;
    updated++;
  } else unavailable++;
}

await Promise.all([
  writeFile(TITLES, '[\n' + titles.map((entry) => '  ' + JSON.stringify(entry)).join(',\n') + '\n]\n'),
  writeFile(GENERATED, JSON.stringify(generated, null, 2) + '\n'),
]);
console.log(`Backfilled saved episode totals for ${updated} finished series.`);
console.log(`${unavailable} finished series still have no saved episode count.`);
