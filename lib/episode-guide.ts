import { client } from '@/scripts/tmdb.mjs';
import { buildEpisodeGuide, countThroughEpisode, type EpisodeGuide } from './episode-progress';
import { entryKey, type Entry, type Generated } from './types';
import type { Store } from './store';
import type { Draft } from './title-mutations';

const nameKey = (name: string) => name.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
async function tvmaze(path: string) {
  const response = await fetch(`https://api.tvmaze.com${path}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Episode catalog unavailable.');
  return response.json();
}

export async function episodeGuideFor(entry: Entry, extra?: Generated): Promise<EpisodeGuide> {
  if ((entry.tmdbKind ?? extra?.tmdbKind) === 'movie') throw new Error('Episode progress is only available for series.');
  if (extra?.episodeGuide && Date.now() - extra.episodeGuide.fetchedAt < 86_400_000) return extra.episodeGuide;
  try {
    let id = extra?.catalogSource === 'tvmaze' ? extra.catalogId : undefined;
    if (!id) {
      const rows: { show: { id: number; name: string; premiered?: string | null } }[] = await tvmaze(`/search/shows?q=${encodeURIComponent(entry.title)}`);
      const matches = rows.filter(({ show }) => [entry.title, extra?.tmdbName].some((name) => name && nameKey(name) === nameKey(show.name)) && (!extra?.year || Number(show.premiered?.slice(0, 4)) === extra.year));
      if (matches.length !== 1) throw new Error('No unique matching show.');
      id = matches[0].show.id;
    }
    if (!Number.isSafeInteger(id) || id! <= 0) throw new Error('Invalid catalog ID.');
    return buildEpisodeGuide(await tvmaze(`/shows/${id}/episodes`), 'tvmaze');
  } catch {
    const id = extra?.tmdbId ?? entry.tmdbId;
    const secret = process.env.TMDB_API_KEY;
    if (secret && Number.isSafeInteger(id) && id! > 0) {
      try {
        const get = client(secret);
        const detail = await get(`/tv/${id}`);
        const numbers: number[] = (detail.seasons ?? []).map((item: { season_number: number }) => item.season_number).filter((season: number) => Number.isSafeInteger(season) && season > 0);
        const episodes: { season: number; number: number }[] = [];
        // Bound concurrent catalog requests for long-running shows.
        for (let offset = 0; offset < numbers.length; offset += 4) {
          const seasons = await Promise.all(numbers.slice(offset, offset + 4).map((season) => get(`/tv/${id}/season/${season}`)));
          seasons.forEach((season) => (season.episodes ?? []).forEach((episode: { season_number: number; episode_number: number }) => episodes.push({ season: episode.season_number, number: episode.episode_number })));
        }
        return buildEpisodeGuide(episodes, 'tmdb');
      } catch { /* Keep credentials and upstream connection details out of user-facing errors. */ }
    }
    throw new Error('Could not load a unique episode list for this show. Try again, or use total episodes watched.');
  }
}

export async function resolveProgressDraft(store: Store, key: string, draft: Draft) {
  // Resolve season/episode on the server; never trust a client-calculated total.
  if (draft.tmdbKind === 'movie') return { store, draft: { ...draft, progressMode: 'count' as const, progress: undefined, episodes: '' } };
  if (draft.progressMode !== 'season') return { store, draft: { ...draft, progress: undefined } };
  if (!/^\d+$/.test(draft.season ?? '') || !/^\d+$/.test(draft.episode ?? '')) throw new Error('Enter a season and last-watched episode.');
  const entry = store.titles.find((item) => entryKey(item) === key);
  if (!entry) throw new Error('That title is no longer in your collection.');
  const extra = store.generated[key];
  const guide = await episodeGuideFor(entry, extra);
  const progress = { season: Number(draft.season), episode: Number(draft.episode) };
  const episodes = countThroughEpisode(guide, progress);
  if (draft.status === 'Finished' && episodes !== guide.totalEpisodes) throw new Error('Choose Watching, On hold or another unfinished status for partial episode progress.');
  const generated = { ...store.generated };
  if (extra) generated[key] = { ...extra, episodeGuide: guide, totalEpisodes: guide.totalEpisodes };
  return { store: { ...store, generated }, draft: { ...draft, episodes: String(episodes), totalEpisodes: guide.totalEpisodes, progress } };
}
