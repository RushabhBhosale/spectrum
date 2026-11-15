import { hash, validateChanges } from '@/scripts/mobile-security.mjs';
import { entryKey, type Entry } from './types';
import type { Store } from './store';
import { buildTitleUpdate } from './title-mutations';
import { MobileError } from './mobile-auth';

export function mobileTitle(entry: Entry, store: Store) {
  const extra = store.generated[entryKey(entry)];
  return {
    id: entryKey(entry), title: entry.title, type: entry.type,
    kind: entry.tmdbKind ?? extra?.tmdbKind ?? 'tv', year: extra?.year ?? null,
    rating: entry.rating, status: entry.status || 'Finished',
    revision: hash(JSON.stringify({ entry, extra })),
  };
}

export function prepareMobileUpdate(store: Store, id: unknown, revision: unknown, input: unknown) {
  if (typeof id !== 'string' || id.length > 250 || typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) throw new MobileError(400, 'A title and its reviewed revision are required.');
  let changes: { status?: string; rating?: number | null };
  try { changes = validateChanges(input); } catch (error) { throw new MobileError(400, (error as Error).message); }
  const entry = store.titles.find((title) => entryKey(title) === id);
  if (!entry) throw new MobileError(404, 'That title is no longer in the collection. Refresh and try again.');
  if (mobileTitle(entry, store).revision !== revision) throw new MobileError(409, 'That title changed since your review. Refresh and review the new values.');
  const extra = store.generated[id];
  const update = buildTitleUpdate(store, id, {
    title: entry.title, type: entry.type,
    rating: changes.rating === undefined ? entry.rating == null ? '' : String(entry.rating) : changes.rating == null ? '' : String(changes.rating),
    status: changes.status ?? entry.status ?? 'Finished',
    episodes: entry.episodes ? String(entry.episodes) : '', quote: entry.quote ?? '',
    tmdbKind: entry.tmdbKind ?? extra?.tmdbKind,
    totalEpisodes: entry.totalEpisodes ?? extra?.totalEpisodes,
  });
  // A mobile status/rating edit must never silently rename a legacy title or trim its quote.
  if (update.key !== id) throw new MobileError(409, 'This title needs review in Studio before it can be updated from Memonest.');
  const changed = update.store.titles.find((title) => entryKey(title) === id)!;
  if (entry.quote === undefined) delete changed.quote;
  else changed.quote = entry.quote;
  return update;
}
