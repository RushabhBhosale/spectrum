import { colourName, hueKey } from './colour';
import { CATEGORIES, isUnfinished, type Title } from './types';

const FRAMES_PER_HOUR = 3600 * 24;
const MIN_TITLES_FOR_BEST = 5;

const byHue = (a: Title, b: Title) => hueKey(a.accent) - hueKey(b.accent);

export function averageRating(titles: Title[]) {
  const ratings = titles.flatMap((t) => (t.rating === null ? [] : [t.rating]));
  return ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
}

function groupBy<K>(titles: Title[], keys: (t: Title) => K[]) {
  const groups = new Map<K, Title[]>();
  for (const t of titles) for (const key of keys(t)) groups.set(key, [...(groups.get(key) ?? []), t]);
  return [...groups.entries()].map(([key, list]) => ({ key, titles: list })).sort((a, b) => b.titles.length - a.titles.length);
}

export function summarise(titles: Title[]) {
  const hours = titles.reduce((sum, t) => sum + t.hours, 0);
  const top = groupBy(titles, (t) => [colourName(t.accent)])[0];
  return {
    count: titles.length,
    hours,
    days: Math.round(hours / 24),
    frames: hours * FRAMES_PER_HOUR,
    average: averageRating(titles),
    unfinished: titles.filter(isUnfinished).length,
    topColour: top ? { name: top.key, hex: top.titles[0].accent } : null,
  };
}

export type RatingBucket = { rating: number; titles: Title[] };

/** One half-point bucket from the lowest rating to 10, so gaps in the ratings stay visible. */
export function ratingBuckets(titles: Title[]): RatingBucket[] {
  const rated = titles.filter((t) => t.rating !== null);
  if (!rated.length) return [];
  const bucketOf = (t: Title) => Math.floor(t.rating! * 2) / 2;
  const low = Math.min(...rated.map(bucketOf));
  const buckets: RatingBucket[] = [];
  for (let rating = low; rating <= 10; rating += 0.5) {
    buckets.push({ rating, titles: rated.filter((t) => bucketOf(t) === rating).sort(byHue) });
  }
  return buckets;
}

export function genreShares(titles: Title[], limit = 10) {
  return groupBy(titles, (t) => t.genres)
    .slice(0, limit)
    .map(({ key, titles: list }) => ({ genre: key, count: list.length, average: averageRating(list), titles: [...list].sort(byHue) }));
}

export function yearBars(titles: Title[]) {
  const dated = titles.filter((t) => t.year);
  if (!dated.length) return [];
  const years = dated.map((t) => t.year!);
  const bars = [];
  for (let year = Math.min(...years); year <= Math.max(...years); year++) {
    bars.push({ year, titles: dated.filter((t) => t.year === year).sort(byHue) });
  }
  return bars;
}

export type Superlative = { label: string; value: string; note: string; title?: Title };

export function superlatives(titles: Title[]): Superlative[] {
  if (!titles.length) return [];
  const pick = (compare: (a: Title, b: Title) => number) => [...titles].sort(compare)[0];
  const longest = pick((a, b) => b.hours - a.hours);
  const oldest = titles.some((t) => t.year) ? pick((a, b) => (a.year ?? 9999) - (b.year ?? 9999)) : undefined;
  const genre = groupBy(titles, (t) => t.genres)[0];
  const busiestYear = groupBy(titles.filter((t) => t.year), (t) => [t.year!])[0];
  const reels = CATEGORIES.map((type) => titles.filter((t) => t.type === type)).filter((list) => list.length >= MIN_TITLES_FOR_BEST);
  const bestReel = [...reels].sort((a, b) => averageRating(b) - averageRating(a))[0];
  const tens = titles.filter((t) => t.rating === 10);

  const list: (Superlative | null)[] = [
    { label: 'Longest journey', value: longest.name, note: `${longest.hours.toLocaleString('en-US')} hours`, title: longest },
    genre ? { label: 'Favourite genre', value: genre.key, note: `${genre.titles.length} titles`, title: genre.titles[0] } : null,
    bestReel ? { label: 'Highest-rated reel', value: bestReel[0].type, note: `${averageRating(bestReel).toFixed(1)} average`, title: bestReel[0] } : null,
    busiestYear ? { label: 'Best-stocked year', value: String(busiestYear.key), note: `${busiestYear.titles.length} titles`, title: busiestYear.titles[0] } : null,
    oldest ? { label: 'Oldest title', value: oldest.name, note: String(oldest.year), title: oldest } : null,
    tens.length ? { label: 'Perfect tens', value: String(tens.length), note: tens.length === 1 ? 'title' : 'titles', title: tens[0] } : null,
  ];
  return list.filter((s): s is Superlative => s !== null);
}
