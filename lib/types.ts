export const CATEGORIES = ['Anime', 'K-drama', 'C-drama', 'J-drama', 'Web series', 'Hindi series'] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ['Finished', 'Watching', 'On hold', 'Dropped', 'Unfinished'] as const;

export type Title = {
  id: string;
  name: string;
  type: Category;
  rating: number | null;
  /** First release year, from TMDB. */
  year?: number;
  hours: number;
  /** Empty when finished. Otherwise e.g. Dropped, On hold, Unfinished or Watching. */
  status?: string;
  review?: string;
  quote?: string;
  quoteBy?: string;
  /** Seven hex colours, from light to dark. */
  colours: string[];
  /** The one colour that best represents the title. */
  accent: string;
  genres: string[];
  poster?: string;
  backdrop?: string;
  /** Film stills for montages. */
  stills: string[];
  /** The show's official transparent logo. */
  logo?: string;
};

/** A line in data/titles.json. */
export type Entry = {
  title: string;
  type: Category;
  rating: number | null;
  status?: string;
  review?: string;
  quote?: string;
  quoteBy?: string;
  /** Episodes actually watched. */
  episodes?: number;
  hours?: number;
  colours?: string[];
  tmdbId?: number;
  tmdbKind?: 'tv' | 'movie';
};

/** What `npm run colours` and the studio store for a title. */
export type Generated = {
  tmdbId?: number;
  catalogSource?: 'tvmaze';
  catalogId?: number;
  runtimeMinutes?: number;
  tmdbKind: 'tv' | 'movie';
  tmdbName?: string;
  year?: number;
  hours: number;
  colours: string[];
  accent?: string;
  genres?: string[];
  poster?: string;
  backdrop?: string;
  stills?: string[];
  logo?: string;
};

export const entryKey = (entry: Pick<Entry, 'title' | 'type'>) => `${entry.type}:${entry.title}`;
export const isUnfinished = (title: Pick<Title, 'status'>) => Boolean(title.status) && title.status !== 'Watching';
