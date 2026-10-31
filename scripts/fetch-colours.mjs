// Reads data/titles.json and writes each title's colours, hours and images to
// data/generated.json. Titles already there are skipped; pass --force to redo them.
import { readFile, writeFile } from 'node:fs/promises';
import { enrich } from './enrich.mjs';
import { client } from './tmdb.mjs';

const TITLES = new URL('../data/titles.json', import.meta.url);
const GENERATED = new URL('../data/generated.json', import.meta.url);
const CATEGORIES = ['Anime', 'K-drama', 'C-drama', 'J-drama', 'Web series', 'Hindi series'];
const WORKERS = 4;

function problems(entry, index) {
  const name = entry.title ? `"${entry.title}"` : `entry ${index + 1}`;
  const found = [];
  if (!entry.title) found.push(`${name} has no title`);
  if (!CATEGORIES.includes(entry.type)) found.push(`${name} needs a type from: ${CATEGORIES.join(', ')}`);
  const validRating = entry.rating === null || (typeof entry.rating === 'number' && entry.rating >= 0 && entry.rating <= 10);
  if (!validRating) found.push(`${name} needs a rating from 0 to 10, or null if unrated`);
  return found;
}

async function main() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    console.error('Add TMDB_API_KEY to .env first. See .env.example.');
    process.exit(1);
  }
  const titles = JSON.parse(await readFile(TITLES, 'utf8'));
  const generated = JSON.parse(await readFile(GENERATED, 'utf8'));
  const invalid = titles.flatMap(problems);
  if (invalid.length) {
    console.error(`Fix these in data/titles.json first:\n- ${invalid.join('\n- ')}`);
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const queue = titles.filter((t) => force || !generated[`${t.type}:${t.title}`]);
  const get = client(key);
  const missed = [];
  let done = 0;

  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const label = `${entry.type}:${entry.title}`;
      try {
        // Re-use the match already checked, so --force can't swap a title for another show.
        const known = generated[label];
        const result = await enrich(get, known ? { ...entry, tmdbId: known.tmdbId, tmdbKind: known.tmdbKind } : entry);
        if (result) {
          generated[label] = result;
          done++;
          console.log(`${entry.title} -> ${result.tmdbName}`);
        } else missed.push(`${entry.title}: not found on TMDB`);
      } catch (error) {
        missed.push(`${entry.title}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));

  await writeFile(GENERATED, JSON.stringify(generated, null, 2) + '\n');
  console.log(`\nUpdated ${done} titles.`);
  if (missed.length) {
    console.log(`\nNeeds attention (add a tmdbId, or colours and hours by hand):\n- ${missed.join('\n- ')}`);
    process.exit(1);
  }
}

main();
