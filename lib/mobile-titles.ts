import { hash, validateChanges } from '@/scripts/mobile-security.mjs';
import { entryKey, type Entry } from './types';
import type { Store } from './store';
import { resolveProgressDraft } from './episode-guide';
import { buildTitleUpdate } from './title-mutations';
import { MobileError } from './mobile-auth';

export function mobileTitle(entry: Entry, store: Store) {
  const extra = store.generated[entryKey(entry)];
  const total = extra?.totalEpisodes ?? entry.totalEpisodes ?? null;
  const episodes = entry.episodes ?? (!entry.status || entry.status === 'Finished' ? total : null);
  return {
    id: entryKey(entry), title: entry.title, type: entry.type,
    kind: entry.tmdbKind ?? extra?.tmdbKind ?? 'tv', year: extra?.year ?? null,
    episodes: (entry.tmdbKind ?? extra?.tmdbKind) === 'movie' ? null : episodes,
    totalEpisodes: (entry.tmdbKind ?? extra?.tmdbKind) === 'movie' ? null : total,
    progress: (entry.tmdbKind ?? extra?.tmdbKind) === 'movie' ? null : entry.progress ?? null,
    rating: entry.rating, status: entry.status || 'Finished',
    revision: hash(JSON.stringify({ entry, extra })),
  };
}

export async function prepareMobileUpdate(store: Store, id: unknown, revision: unknown, input: unknown) {
  if (typeof id !== 'string' || id.length > 250 || typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) throw new MobileError(400, 'A title and its reviewed revision are required.');
  let changes: { status?: string; rating?: number | null; episodes?: number; progress?: { season: number; episode: number } };
  try { changes = validateChanges(input); } catch (error) { throw new MobileError(400, (error as Error).message); }
  const entry = store.titles.find((title) => entryKey(title) === id);
  if (!entry) throw new MobileError(404, 'That title is no longer in the collection. Refresh and try again.');
  if (mobileTitle(entry, store).revision !== revision) throw new MobileError(409, 'That title changed since your review. Refresh and review the new values.');
  const extra = store.generated[id];
  if ((entry.tmdbKind ?? extra?.tmdbKind) === 'movie' && (changes.episodes !== undefined || changes.progress)) throw new MobileError(400, 'Episode progress is only available for series.');
  const total = extra?.totalEpisodes ?? entry.totalEpisodes;
  if (!changes.progress && changes.episodes !== undefined && total && changes.episodes > total) throw new MobileError(400, `Episodes watched cannot exceed ${total}.`);
  if (!changes.progress && changes.episodes !== undefined && (changes.status ?? entry.status ?? 'Finished') === 'Finished' && total && changes.episodes !== total) throw new MobileError(400, 'Choose an unfinished status to save partial episode progress.');
  let resolved;
  try {
    resolved = await resolveProgressDraft(store, id, {
    title: entry.title, type: entry.type,
    rating: changes.rating === undefined ? entry.rating == null ? '' : String(entry.rating) : changes.rating == null ? '' : String(changes.rating),
    status: changes.status ?? entry.status ?? 'Finished',
    episodes: changes.episodes !== undefined ? String(changes.episodes) : entry.episodes != null ? String(entry.episodes) : '',
    progressMode: changes.progress ? 'season' : 'count', season: changes.progress ? String(changes.progress.season) : undefined, episode: changes.progress ? String(changes.progress.episode) : undefined, quote: entry.quote ?? '',
    tmdbKind: entry.tmdbKind ?? extra?.tmdbKind,
    totalEpisodes: extra?.totalEpisodes ?? entry.totalEpisodes,
    });
  } catch (error) { throw new MobileError(400, (error as Error).message); }
  if (changes.episodes !== undefined && changes.progress && Number(resolved.draft.episodes) !== changes.episodes) throw new MobileError(409, 'The episode list changed. Reload and review the calculated count again.');
  let update;
  try { update = buildTitleUpdate(resolved.store, id, resolved.draft); }
  catch (error) { throw new MobileError(400, (error as Error).message); }
  // A mobile progress edit must never silently rename a legacy title or trim its quote.
  if (update.key !== id) throw new MobileError(409, 'This title needs review in Studio before it can be updated from Memonest.');
  const changed = update.store.titles.find((title) => entryKey(title) === id)!;
  if (entry.quote === undefined) delete changed.quote;
  else changed.quote = entry.quote;
  return update;
}
