import type { EpisodePosition } from './episode-progress';
import { estimateHours } from './data';
import { CATEGORIES, entryKey, STATUSES, type Category, type Entry } from './types';
import type { Store } from './store';
const MAX_NAME = 120;
const MAX_QUOTE = 400;

export type Draft = {
  title: string;
  type: Category;
  rating: string;
  status: string;
  episodes: string;
  quote: string;
  tvmazeId?: number;
  posterUrl?: string;
  tmdbKind?: 'tv' | 'movie';
  totalEpisodes?: number;
  progressMode?: 'count' | 'season';
  season?: string;
  episode?: string;
  progress?: EpisodePosition;
};
export function toEntry(draft: Draft, previous?: Entry): Entry | string {
  const title = draft.title.trim().slice(0, MAX_NAME);
  if (!title) return 'Give it a title.';
  if (!CATEGORIES.includes(draft.type)) return 'Pick a category.';
  const rating = draft.rating.trim() === '' ? null : Number(draft.rating);
  if (rating !== null && !(rating >= 0 && rating <= 10)) return 'Ratings go from 0 to 10.';
  const episodes = draft.episodes.trim() === '' ? undefined : Number(draft.episodes);
  if (episodes !== undefined && !(Number.isSafeInteger(episodes) && episodes >= 0)) return 'Episodes should be a whole number of zero or more.';
  if ((draft.tmdbKind ?? previous?.tmdbKind) !== 'movie' && episodes !== undefined && draft.totalEpisodes && episodes > draft.totalEpisodes) return `Episodes watched cannot exceed ${draft.totalEpisodes}.`;
  if (draft.status && !(STATUSES as readonly string[]).includes(draft.status) && draft.status !== previous?.status) return 'Pick a status.';

  const entry: Entry = { ...previous, title, type: draft.type, rating };
  const setText = (field: 'status' | 'quote', value: string, limit: number) => {
    const text = value.trim().slice(0, limit);
    if (text) entry[field] = text;
    else delete entry[field];
  };
  setText('status', draft.status === 'Finished' ? '' : draft.status, MAX_NAME);
  setText('quote', draft.quote, MAX_QUOTE);
  if ((draft.tmdbKind ?? previous?.tmdbKind) === 'movie') delete entry.episodes;
  else if (episodes !== undefined) entry.episodes = episodes;
  else delete entry.episodes;
  if ((draft.tmdbKind ?? previous?.tmdbKind) === 'movie') delete entry.progress;
  else if (draft.progressMode === 'season') {
    if (!draft.progress || !Number.isSafeInteger(draft.progress.season) || draft.progress.season <= 0 || !Number.isSafeInteger(draft.progress.episode) || draft.progress.episode <= 0) return 'Enter valid season/episode progress.';
    entry.progress = draft.progress;
  } else if (entry.episodes !== previous?.episodes) delete entry.progress;
  if (draft.totalEpisodes !== undefined && Number.isSafeInteger(draft.totalEpisodes) && draft.totalEpisodes > 0) entry.totalEpisodes = draft.totalEpisodes;
  if (draft.tmdbKind) entry.tmdbKind = draft.tmdbKind;
  return entry;
}


export function buildTitleUpdate(store: Store, key: string, draft: Draft) {
  const index = store.titles.findIndex((t) => entryKey(t) === key);
  if (index < 0) throw new Error("That title isn't in your list any more.");
  const previous = store.titles[index];
  const entry = toEntry(draft, previous);
  if (typeof entry === 'string') throw new Error(entry);
  const nextKey = entryKey(entry);
  if (nextKey !== key && store.titles.some((t) => entryKey(t) === nextKey)) {
    throw new Error(`${entry.title} is already in ${entry.type}.`);
  }

  const generated = { ...store.generated };
  const known = generated[key];
  if (known?.totalEpisodes && entry.tmdbKind !== 'movie') {
    entry.totalEpisodes = known.totalEpisodes;
    if (!entry.status) {
      if (entry.episodes !== known.totalEpisodes) delete entry.progress;
      entry.episodes = known.totalEpisodes;
    }
    else if (entry.episodes && entry.episodes > known.totalEpisodes) throw new Error(`Episodes watched cannot exceed ${known.totalEpisodes}.`);
  }
  delete generated[key];
  const episodesChanged = entry.episodes !== previous.episodes;
  if (known) {
    const runtime = known.runtimeMinutes ?? (previous.episodes ? known.hours * 60 / previous.episodes : undefined);
    const hours = episodesChanged && (entry.tmdbKind ?? known.tmdbKind) !== 'movie'
      ? (entry.episodes === 0 ? 0 : entry.episodes && runtime ? Math.max(1, Math.round(entry.episodes * runtime / 60)) : estimateHours(entry))
      : known.hours;
    generated[nextKey] = { ...known, tmdbKind: entry.tmdbKind ?? known.tmdbKind, hours };
  }

  const titles = [...store.titles];
  titles[index] = entry;
  return { store: { titles, generated, version: store.version }, key: nextKey };

}
