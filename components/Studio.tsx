'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addTitle, removeTitle, searchTitles, signOut, updateTitle, type Draft, type Match, type Result } from '@/app/studio/actions';
import { SITE_NAME } from '@/lib/site';
import { countWith, isFiltered, matches as matchesFilters, NO_FILTERS, NOTE_OPTIONS, RATING_OPTIONS, SORTS, sortTitles, statusOf, STATUS_OPTIONS, type Filters, type ListedTitle } from '@/lib/title-list';
import { CATEGORIES, entryKey, STATUSES, type Category, type Entry } from '@/lib/types';

const STACKED_WIDTH = 860;

const blank = (title: string, type: Category): Draft => ({ title, type, rating: '', status: 'Finished', episodes: '', quote: '' });

const fromEntry = (entry: Entry): Draft => ({
  title: entry.title,
  type: entry.type,
  rating: entry.rating === null ? '' : String(entry.rating),
  status: entry.status ?? 'Finished',
  episodes: entry.episodes ? String(entry.episodes) : '',
  quote: entry.quote ?? '',
});

type Editing = { key: string | null; draft: Draft; poster?: string; year?: number };

export default function Studio({ titles }: { titles: ListedTitle[] }) {
  const router = useRouter();
  const workspace = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState(SORTS[0].id);
  const [notice, setNotice] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();

  const owned = useMemo(() => sortTitles(titles.filter((title) => matchesFilters(title, filters)), sort), [titles, filters, sort]);
  const filtered = isFiltered(filters);
  const editingKey = editing?.key;

  useEffect(() => { list.current?.scrollTo({ top: 0 }); }, [filters, sort]);

  // On a phone the editor sits above the list, so bring it into view.
  useEffect(() => {
    if (editingKey && innerWidth <= STACKED_WIDTH) workspace.current?.scrollIntoView();
  }, [editingKey]);

  const filterBy = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }));
  const optionLabel = (label: string, change: Partial<Filters>) => `${label} (${countWith(titles, filters, change)})`;

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
    setEditing({ key: null, draft: { ...blank(match.name, match.type), tmdbId: match.id, tmdbKind: match.kind }, poster: match.poster, year: match.year });
  };

  const open = (entry: ListedTitle) => {
    setNotice(null);
    setConfirming(false);
    setEditing({ key: entryKey(entry), draft: fromEntry(entry), poster: entry.poster, year: entry.year });
  };

  return (
    <main className="wrap studio">
      <header className="studio-head">
        <a className="label" href="/">Back to {SITE_NAME}</a>
        <button className="label" onClick={() => start(async () => { await signOut(); router.refresh(); })}>Sign out</button>
      </header>
      <div className="studio-title">
        <div><h1>Studio</h1><p className="studio-subtitle">Your watchlist, all in one place.</p></div>
        <div className="studio-overview">
          <button aria-pressed={!filtered} onClick={() => setFilters(NO_FILTERS)}><strong>{titles.length}</strong> titles</button>
          <button aria-pressed={filters.rating === 'none'} onClick={() => filterBy({ rating: filters.rating === 'none' ? '' : 'none' })}><strong>{titles.filter((t) => t.rating === null).length}</strong> unrated</button>
          <button aria-pressed={filters.notes === 'quote'} onClick={() => filterBy({ notes: filters.notes === 'quote' ? '' : 'quote' })}><strong>{titles.filter((t) => t.quote).length}</strong> quotes</button>
        </div>
      </div>

      <div className="studio-grid">
        <section className="studio-list">
          <div className="studio-list-head">
            <h2>My list</h2>
            <p role="status">{filtered ? `${owned.length} of ${titles.length}` : `${titles.length} titles`}</p>
            {filtered && <button className="studio-clear" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}
            <button className="studio-add" onClick={() => { setEditing(null); setNotice(null); requestAnimationFrame(() => workspace.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>+ Add title</button>
          </div>
          <div className="studio-status-tabs" role="group" aria-label="Watch status">
            <button aria-pressed={!filters.status} onClick={() => filterBy({ status: '' })}>All <span>{countWith(titles, filters, { status: '' })}</span></button>
            {STATUS_OPTIONS.map(({ id, label }) => (
              <button key={id} aria-pressed={filters.status === id} onClick={() => filterBy({ status: id })}>{label} <span>{countWith(titles, filters, { status: id })}</span></button>
            ))}
          </div>
          <input id="owned-filter" type="search" aria-label="Find one of your titles" placeholder="Find a title" value={filters.text} onChange={(e) => filterBy({ text: e.target.value })} />
          <div className="studio-tabs" role="group" aria-label="Category">
            <button aria-pressed={!filters.category} onClick={() => filterBy({ category: '' })}>All <small>{countWith(titles, filters, { category: '' })}</small></button>
            {CATEGORIES.map((category) => (
              <button key={category} aria-pressed={filters.category === category} onClick={() => filterBy({ category })}>{category} <small>{countWith(titles, filters, { category })}</small></button>
            ))}
          </div>
          <div className="studio-selects">
            <label><span className="label">Rating</span>
              <select id="filter-rating" value={filters.rating} onChange={(e) => filterBy({ rating: e.target.value })}>
                <option value="">Any rating</option>
                {RATING_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{optionLabel(label, { rating: id })}</option>)}
              </select>
            </label>
            <label><span className="label">Quotes</span>
              <select id="filter-notes" value={filters.notes} onChange={(e) => filterBy({ notes: e.target.value })}>
                <option value="">Any quote status</option>
                {NOTE_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{optionLabel(label, { notes: id })}</option>)}
              </select>
            </label>
            <label><span className="label">Sort by</span>
              <select id="sort-titles" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="owned-head" aria-hidden="true"><span>Title</span><span>Progress</span><span>Score</span></div>
          <div className="owned" ref={list}>
            {owned.map((entry) => {
              return (
                <button key={entryKey(entry)} onClick={() => open(entry)} aria-pressed={editingKey === entryKey(entry)}>
                  {entry.poster ? <img src={entry.poster.replace('/w342/', '/w92/')} alt="" loading="lazy" decoding="async" /> : <span className="no-poster" />}
                  <span className="owned-name">
                    <span>{entry.title}</span>
                    <small>{[entry.type, entry.year, statusOf(entry)].filter(Boolean).join(' · ')}</small>
                  </span>
                  <span className="owned-progress"><span className="owned-mobile-label">Progress </span>{entry.episodes ? `${entry.episodes} ep` : '—'}</span>
                  <b className={entry.rating === null ? 'unrated' : undefined}><span className="owned-mobile-label">Score </span>{entry.rating?.toFixed(1) ?? '—'}</b>
                </button>
              );
            })}
            {owned.length === 0 && (
              <div className="studio-none">
                <p>No titles match these filters.</p>
                <button onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
              </div>
            )}
          </div>
        </section>

        <section className="studio-work" ref={workspace}>
          {notice && <p className={`notice ${notice.ok ? '' : 'bad'}`} role="status">{notice.message}</p>}
          {editing ? (
            <form className="editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <div className="editor-heading"><div><h2>{editing.key ? 'Edit title' : 'Add to your list'}</h2><p className="editor-note">Update your progress, rating and notes.</p></div></div>
              <div className="editor-selection">
                {editing.poster ? <img src={editing.poster} alt={`Poster for ${editing.draft.title}`} /> : <span className="editor-no-poster">No poster available</span>}
                <div><span className="label">{editing.key ? 'Editing' : 'Adding'}</span><strong>{editing.draft.title}</strong><small>{[editing.draft.type, editing.year].filter(Boolean).join(' · ')}</small></div>
              </div>
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
              <div className="editor-actions">
                <button className="solid" disabled={busy}>{busy ? 'Saving…' : editing.key ? 'Save changes' : 'Add to the collection'}</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                {editing.key && !confirming && <button type="button" className="danger" onClick={() => setConfirming(true)}>Remove</button>}
                {editing.key && confirming && <button type="button" className="danger" disabled={busy} onClick={remove}>Yes, remove it</button>}
              </div>
            </form>
          ) : (
            <>
              <h2>Add a title</h2>
              <p className="editor-note">Search for a series or film, then choose the matching poster. Select a title from your list to edit it.</p>
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
            </>
          )}
        </section>
      </div>
    </main>
  );
}
