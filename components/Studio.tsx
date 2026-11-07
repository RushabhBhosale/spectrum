'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addTitle, removeTitle, searchTitles, signOut, updateTitle, type Draft, type Match, type Result } from '@/app/studio/actions';
import { SITE_NAME } from '@/lib/site';
import { countWith, isFiltered, matches as matchesFilters, NO_FILTERS, NOTE_OPTIONS, RATING_OPTIONS, SORTS, sortTitles, statusOf, STATUS_OPTIONS, type Filters, type ListedTitle } from '@/lib/title-list';
import { CATEGORIES, entryKey, STATUSES, type Category } from '@/lib/types';

const blank = (title: string, type: Category): Draft => ({ title, type, rating: '', status: 'Finished', episodes: '', quote: '' });
const fromEntry = (entry: ListedTitle): Draft => ({
  title: entry.title, type: entry.type, rating: entry.rating === null ? '' : String(entry.rating),
  status: entry.status ?? 'Finished', episodes: entry.episodes ? String(entry.episodes) : '', quote: entry.quote ?? '', tmdbKind: entry.tmdbKind ?? 'tv',
});
type Editing = { key: string | null; draft: Draft; poster?: string; year?: number };

export default function Studio({ titles }: { titles: ListedTitle[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (panelOpen && !element.open) element.showModal();
    else if (!panelOpen && element.open) element.close();
  }, [panelOpen]);

  const filterBy = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }));
  const optionLabel = (label: string, change: Partial<Filters>) => `${label} (${countWith(titles, filters, change)})`;
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setEditing((current) => current && { ...current, draft: { ...current.draft, [field]: value } });

  const finish = (result: Result) => {
    setNotice(result);
    if (result.ok) {
      setPanelOpen(false);
      setEditing(null);
      setConfirming(false);
      setMatches(null);
      setQuery('');
      router.refresh();
    }
  };
  const search = () => start(async () => {
    setNotice(null);
    try {
      const result = await searchTitles(query);
      if (result.ok) setMatches(result.matches);
      else { setMatches(null); setNotice(result); }
    } catch { setMatches(null); setNotice({ ok: false, message: 'Could not search right now. Please try again.' }); }
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
    setEditing({ key: null, draft: { ...blank(match.name, match.type), tvmazeId: match.id, tmdbKind: match.kind }, poster: match.poster, year: match.year });
  };
  const manual = () => { setNotice(null); setEditing({ key: null, draft: { ...blank(query.trim(), 'Web series'), tmdbKind: 'tv' } }); };
  const open = (entry: ListedTitle) => {
    setNotice(null);
    setConfirming(false);
    setEditing({ key: entryKey(entry), draft: fromEntry(entry), poster: entry.poster, year: entry.year });
    setPanelOpen(true);
  };
  const openSearch = () => {
    setEditing(null);
    setNotice(null);
    setQuery('');
    setMatches(null);
    setPanelOpen(true);
  };

  return (
    <main className="wrap studio">
      <header className="studio-head">
        <a className="label" href="/">← {SITE_NAME}</a>
        <button className="label" onClick={() => start(async () => { await signOut(); router.refresh(); })}>Sign out</button>
      </header>

      <div className="tracker-title">
        <div><p className="tracker-kicker">Your collection</p><h1>My list <span>{titles.length}</span></h1></div>
        <button className="tracker-add" onClick={openSearch}><span aria-hidden="true">+</span> Add title</button>
      </div>
      {notice && !panelOpen && <p className={`notice tracker-notice ${notice.ok ? '' : 'bad'}`} role="status">{notice.message}</p>}

      <section className="tracker-list" aria-label="Your titles">
        <div className="tracker-status" role="group" aria-label="Watch status">
          <button aria-pressed={!filters.status} onClick={() => filterBy({ status: '' })}>All <span>{countWith(titles, filters, { status: '' })}</span></button>
          {STATUS_OPTIONS.map(({ id, label }) => (
            <button key={id} aria-pressed={filters.status === id} onClick={() => filterBy({ status: id })}>{label} <span>{countWith(titles, filters, { status: id })}</span></button>
          ))}
        </div>
        <div className="tracker-toolbar">
          <label className="tracker-search"><span className="sr-only">Find a title</span><span aria-hidden="true">⌕</span><input id="owned-filter" type="search" placeholder="Search your list" value={filters.text} onChange={(e) => filterBy({ text: e.target.value })} /></label>
          <label className="tracker-select"><span className="sr-only">Category</span><select value={filters.category} onChange={(e) => filterBy({ category: e.target.value as Category | '' })}><option value="">All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="tracker-select"><span className="sr-only">Format</span><select value={filters.format} onChange={(e) => filterBy({ format: e.target.value as Filters['format'] })}><option value="">All formats</option><option value="movie">Movies</option><option value="tv">TV series</option></select></label>
          <label className="tracker-select"><span className="sr-only">Sort by</span><select id="sort-titles" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
          <details className="tracker-more"><summary>More filters{(filters.rating || filters.notes) ? ' •' : ''}</summary><div className="tracker-filter-menu">
            <label><span>Rating</span><select id="filter-rating" value={filters.rating} onChange={(e) => filterBy({ rating: e.target.value })}><option value="">Any rating</option>{RATING_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{optionLabel(label, { rating: id })}</option>)}</select></label>
            <label><span>Quotes</span><select id="filter-notes" value={filters.notes} onChange={(e) => filterBy({ notes: e.target.value })}><option value="">Any quote status</option>{NOTE_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{optionLabel(label, { notes: id })}</option>)}</select></label>
          </div></details>
        </div>
        <div className="tracker-list-meta"><p role="status">{filtered ? `${owned.length} of ${titles.length} titles` : `${titles.length} titles`}</p>{filtered && <button onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>}</div>
        <div className="tracker-columns" aria-hidden="true"><span>Title</span><span>Status</span><span>Progress</span><span>Score</span><span /></div>
        <div className="tracker-entries">
          {owned.map((entry) => (
            <button className="tracker-entry" key={entryKey(entry)} onClick={() => open(entry)} aria-label={`Edit ${entry.title}, ${statusOf(entry)}, ${entry.episodes ? `${entry.episodes} episodes` : 'progress not set'}, ${entry.rating === null ? 'unrated' : `score ${entry.rating.toFixed(1)}`}`}>
              {entry.poster ? <img src={entry.poster.replace('/w342/', '/w92/')} alt="" loading="lazy" decoding="async" /> : <span className="tracker-no-poster" />}
              <span className="tracker-entry-title"><strong>{entry.title}</strong><small>{[entry.type, entry.year].filter(Boolean).join(' · ')}<span className="tracker-mobile-status"> · {statusOf(entry)}</span></small></span>
              <span className="tracker-entry-status">{statusOf(entry)}</span>
              <span className="tracker-entry-progress"><span className="tracker-mobile-label">Progress </span>{entry.episodes ? `${entry.episodes} ep` : '—'}</span>
              <span className="tracker-entry-score"><span className="tracker-mobile-label">Score </span>{entry.rating?.toFixed(1) ?? '—'}</span>
              <span className="tracker-entry-edit" aria-hidden="true">Edit <span>↗</span></span>
            </button>
          ))}
          {owned.length === 0 && <div className="studio-none"><p>No titles match these filters.</p><button onClick={() => setFilters(NO_FILTERS)}>Clear filters</button></div>}
        </div>
      </section>

      <dialog className="studio-dialog" ref={dialog} aria-labelledby="studio-dialog-title" onClose={() => setPanelOpen(false)}>
        <div className="studio-dialog-top"><h2 id="studio-dialog-title">{editing ? (editing.key ? 'Edit title' : 'Add to your list') : 'Add a title'}</h2><button type="button" className="studio-dialog-close" aria-label="Close" onClick={() => setPanelOpen(false)}>×</button></div>
        {notice && panelOpen && <p className={`notice ${notice.ok ? '' : 'bad'}`} role="status">{notice.message}</p>}
        {editing ? (
          <form className="editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="editor-selection">
              {editing.poster || editing.draft.posterUrl?.startsWith('https://') ? <img src={editing.poster ?? editing.draft.posterUrl} alt={`Poster for ${editing.draft.title}`} /> : <span className="editor-no-poster">No poster available</span>}
              <div><span className="label">{editing.key ? 'Editing' : 'Adding'}</span><strong>{editing.draft.title}</strong><small>{[editing.draft.type, editing.year].filter(Boolean).join(' · ')}</small></div>
            </div>
            <label className="field"><span className="label">Format</span><select value={editing.draft.tmdbKind ?? 'tv'} onChange={(e) => set('tmdbKind', e.target.value as 'tv' | 'movie')}><option value="tv">TV series</option><option value="movie">Movie</option></select></label>
            {!editing.key && !editing.draft.tvmazeId && <label className="field"><span className="label">Poster URL (optional)</span><input type="url" placeholder="https://…" value={editing.draft.posterUrl ?? ''} onChange={(e) => set('posterUrl', e.target.value)} /></label>}
            <label className="field"><span className="label">Title</span><input id="edit-title" value={editing.draft.title} onChange={(e) => set('title', e.target.value)} required /></label>
            <div className="field-row">
              <label className="field"><span className="label">Category</span><select id="edit-type" value={editing.draft.type} onChange={(e) => set('type', e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span className="label">Rating out of 10</span><input id="edit-rating" type="number" min="0" max="10" step="0.1" value={editing.draft.rating} onChange={(e) => set('rating', e.target.value)} /></label>
            </div>
            <div className="field-row">
              <label className="field"><span className="label">Status</span><select id="edit-status" value={editing.draft.status} onChange={(e) => set('status', e.target.value)}>{[...new Set([...STATUSES, editing.draft.status])].map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="field"><span className="label">Episodes watched</span><input id="edit-episodes" type="number" min="1" step="1" value={editing.draft.episodes} onChange={(e) => set('episodes', e.target.value)} /></label>
            </div>
            <label className="field"><span className="label">Quote</span><textarea id="edit-quote" rows={2} maxLength={400} placeholder="The line that stayed with you" value={editing.draft.quote} onChange={(e) => set('quote', e.target.value)} /></label>
            <div className="editor-actions">
              <button className="solid" disabled={busy}>{busy ? 'Saving…' : editing.key ? 'Save changes' : 'Add to the collection'}</button>
              <button type="button" onClick={() => editing.key ? setPanelOpen(false) : setEditing(null)}>{editing.key ? 'Cancel' : 'Back to search'}</button>
              {editing.key && !confirming && <button type="button" className="danger" onClick={() => setConfirming(true)}>Remove</button>}
              {editing.key && confirming && <button type="button" className="danger" disabled={busy} onClick={remove}>Yes, remove it</button>}
            </div>
          </form>
        ) : (
          <>
            <p className="editor-note">Search TVmaze for a series and choose the matching poster. You can also add a title manually.</p>
            <form className="search" onSubmit={(e) => { e.preventDefault(); search(); }}><input id="tmdb-search" aria-label="Search for a series" placeholder="Search for a series" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="solid" disabled={busy || !query.trim()}>{busy ? 'Searching…' : 'Search'}</button></form>
            <button className="tracker-manual" type="button" onClick={manual}>Add a title manually →</button>
            {matches?.length === 0 && <p className="notice">Nothing found. Try the English or original title.</p>}
            {matches && matches.length > 0 && <div className="matches">{matches.map((match) => <button key={`${match.kind}-${match.id}`} onClick={() => choose(match)}>{match.poster ? <img src={match.poster} alt="" loading="lazy" /> : <span className="no-poster" />}<span><strong>{match.name}</strong><small>{[match.type, match.year, match.kind === 'movie' ? 'Film' : null].filter(Boolean).join(' · ')}</small></span></button>)}</div>}
          </>
        )}
      </dialog>
    </main>
  );
}
