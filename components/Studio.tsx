'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { addTitle, removeTitle, searchTitles, signOut, updateTitle, type Draft, type Match, type Result } from '@/app/studio/actions';
import { CATEGORIES, entryKey, STATUSES, type Category, type Entry } from '@/lib/types';

const blank = (title: string, type: Category): Draft => ({ title, type, rating: '', status: 'Finished', episodes: '', quote: '', quoteBy: '', review: '' });

const fromEntry = (entry: Entry): Draft => ({
  title: entry.title,
  type: entry.type,
  rating: entry.rating === null ? '' : String(entry.rating),
  status: entry.status ?? 'Finished',
  episodes: entry.episodes ? String(entry.episodes) : '',
  quote: entry.quote ?? '',
  quoteBy: entry.quoteBy ?? '',
  review: entry.review ?? '',
});

type Editing = { key: string | null; draft: Draft };

export default function Studio({ titles }: { titles: Entry[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();

  const owned = useMemo(() => {
    const text = filter.trim().toLowerCase();
    const found = text ? titles.filter((t) => t.title.toLowerCase().includes(text)) : titles;
    return found.slice(0, 40);
  }, [titles, filter]);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setEditing((current) => current && { ...current, draft: { ...current.draft, [field]: value } });

  const finish = (result: Result) => {
    setNotice(result);
    if (result.ok) {
      setEditing(null);
      setConfirming(false);
      setMatches(null);
      setQuery('');
      router.refresh();
    }
  };

  const search = () =>
    start(async () => {
      setNotice(null);
      try {
        setMatches(await searchTitles(query));
      } catch (error) {
        setNotice({ ok: false, message: (error as Error).message });
      }
    });

  const save = () => {
    if (!editing) return;
    const { key, draft } = editing;
    start(async () => finish(key ? await updateTitle(key, draft) : await addTitle(draft)));
  };

  const remove = () => {
    if (!editing?.key) return;
    const { key } = editing;
    start(async () => finish(await removeTitle(key)));
  };

  const choose = (match: Match) => {
    setNotice(null);
    setEditing({ key: null, draft: { ...blank(match.name, match.type), tmdbId: match.id, tmdbKind: match.kind } });
  };

  const open = (entry: Entry) => {
    setNotice(null);
    setConfirming(false);
    setEditing({ key: entryKey(entry), draft: fromEntry(entry) });
  };

  return (
    <main className="wrap studio">
      <header className="studio-head">
        <a className="label" href="/">Back to Spectrum</a>
        <button className="label" onClick={() => start(async () => { await signOut(); router.refresh(); })}>Sign out</button>
      </header>
      <h1>Studio</h1>
      {notice && <p className={`notice ${notice.ok ? '' : 'bad'}`} role="status">{notice.message}</p>}

      <div className="studio-grid">
        <section>
          <h2>Add a series</h2>
          <form className="search" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input id="tmdb-search" aria-label="Search for a series or film" placeholder="The Glory" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="solid" disabled={busy || !query.trim()}>Search</button>
          </form>
          {matches?.length === 0 && <p className="notice">Nothing found. Try the English or original title.</p>}
          {matches && matches.length > 0 && (
            <div className="matches">
              {matches.map((match) => (
                <button key={`${match.kind}-${match.id}`} onClick={() => choose(match)}>
                  {match.poster ? <img src={match.poster} alt="" loading="lazy" /> : <span className="no-poster" />}
                  <span>
                    <strong>{match.name}</strong>
                    <small>{[match.type, match.year, match.kind === 'movie' ? 'Film' : null].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <h2>Your titles</h2>
          <input id="owned-filter" aria-label="Find one of your titles" placeholder="Find a title to add a quote" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="owned">
            {owned.map((entry) => (
              <button key={entryKey(entry)} onClick={() => open(entry)} aria-pressed={editing?.key === entryKey(entry)}>
                <span>{entry.title}</span>
                <small>{entry.quote ? 'Has quote · ' : ''}{entry.rating?.toFixed(1) ?? 'Unrated'}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          {editing ? (
            <form className="editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <h2>{editing.key ? 'Edit title' : 'New title'}</h2>
              <label className="field"><span className="label">Title</span>
                <input id="edit-title" value={editing.draft.title} onChange={(e) => set('title', e.target.value)} required />
              </label>
              <div className="field-row">
                <label className="field"><span className="label">Category</span>
                  <select id="edit-type" value={editing.draft.type} onChange={(e) => set('type', e.target.value as Category)}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field"><span className="label">Rating out of 10</span>
                  <input id="edit-rating" type="number" min="0" max="10" step="0.1" value={editing.draft.rating} onChange={(e) => set('rating', e.target.value)} />
                </label>
              </div>
              <div className="field-row">
                <label className="field"><span className="label">Status</span>
                  <select id="edit-status" value={editing.draft.status} onChange={(e) => set('status', e.target.value)}>
                    {[...new Set([...STATUSES, editing.draft.status])].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="field"><span className="label">Episodes watched</span>
                  <input id="edit-episodes" type="number" min="1" step="1" value={editing.draft.episodes} onChange={(e) => set('episodes', e.target.value)} />
                </label>
              </div>
              <label className="field"><span className="label">Quote</span>
                <textarea id="edit-quote" rows={3} maxLength={400} placeholder="The line that stayed with you" value={editing.draft.quote} onChange={(e) => set('quote', e.target.value)} />
              </label>
              <label className="field"><span className="label">Said by</span>
                <input id="edit-quote-by" placeholder="Character name" value={editing.draft.quoteBy} onChange={(e) => set('quoteBy', e.target.value)} />
              </label>
              <label className="field"><span className="label">Your take</span>
                <textarea id="edit-review" rows={3} maxLength={1000} value={editing.draft.review} onChange={(e) => set('review', e.target.value)} />
              </label>
              <div className="editor-actions">
                <button className="solid" disabled={busy}>{busy ? 'Saving…' : editing.key ? 'Save changes' : 'Add to Spectrum'}</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                {editing.key && !confirming && <button type="button" className="danger" onClick={() => setConfirming(true)}>Remove</button>}
                {editing.key && confirming && <button type="button" className="danger" disabled={busy} onClick={remove}>Yes, remove it</button>}
              </div>
            </form>
          ) : (
            <p className="notice studio-empty">Search for a series to add it, or pick one of your titles to add a quote.</p>
          )}
        </section>
      </div>
    </main>
  );
}
