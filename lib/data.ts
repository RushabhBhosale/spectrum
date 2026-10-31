import generated from '@/data/generated.json';
import entries from '@/data/titles.json';
import { placeholderColours } from './placeholder';
import { entryKey, type Category, type Entry, type Generated, type Title } from './types';

const FILM_HOURS = 2;
const EPISODE_MINUTES: Record<Category, number> = {
  Anime: 24, 'K-drama': 60, 'C-drama': 45, 'J-drama': 45, 'Web series': 45, 'Hindi series': 40,
};
// Used until TMDB supplies a real figure for a title with no episode count.
const TYPICAL_HOURS: Record<Category, number> = {
  Anime: 5, 'K-drama': 16, 'C-drama': 24, 'J-drama': 8, 'Web series': 40, 'Hindi series': 7,
};

function estimateHours(entry: Entry) {
  if (entry.tmdbKind === 'movie') return FILM_HOURS;
  if (entry.episodes) return Math.max(1, Math.round((entry.episodes * EPISODE_MINUTES[entry.type]) / 60));
  return TYPICAL_HOURS[entry.type];
}

const slug = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function loadTitles(): { titles: Title[]; placeholders: number } {
  const extra = generated as unknown as Record<string, Generated>;
  const used = new Set<string>();
  let placeholders = 0;
  const titles = (entries as unknown as Entry[]).map((entry) => {
    const found = extra[entryKey(entry)];
    const colours = entry.colours ?? found?.colours;
    if (!colours) placeholders++;
    const palette = colours ?? placeholderColours(entry.title, entry.type);
    const base = slug(entry.title) || slug(entry.type);
    const id = used.has(base) ? `${base}-${slug(entry.type)}` : base;
    used.add(id);
    return {
      id,
      name: entry.title,
      type: entry.type,
      rating: entry.rating,
      status: entry.status,
      review: entry.review,
      quote: entry.quote,
      quoteBy: entry.quoteBy,
      hours: entry.hours ?? found?.hours ?? estimateHours(entry),
      colours: palette,
      accent: found?.accent ?? palette[3],
      genres: found?.genres ?? [],
      poster: found?.poster,
      backdrop: found?.backdrop,
      year: found?.year,
    };
  });
  return { titles, placeholders };
}
