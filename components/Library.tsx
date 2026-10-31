'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { statusOf } from '@/lib/title-list';
import { CATEGORIES, type Category, type Title } from '@/lib/types';
import Poster from './Poster';

const PAGE = 24;
type Props = { titles: Title[]; onOpen: (title: Title) => void; category: 'all' | Category; onCategory: (category: 'all' | Category) => void };

function Library({ titles, onOpen, category, onCategory }: Props) {
  const gallery = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'posters' | 'list'>('posters');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('added');
  const [limit, setLimit] = useState(PAGE);
  const found = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = titles.filter(t => (category === 'all' || t.type === category) && (!text || t.name.toLowerCase().includes(text)) && (status === 'all' || statusOf(t) === status) && (rating === 'all' || (t.rating !== null && t.rating >= Number(rating))));
    if (sort === 'rating') list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'year') list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return list;
  }, [titles, query, category, status, rating, sort]);
  useEffect(() => {
    if (view !== 'posters' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(entries => entries.forEach((entry, index) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (document.querySelector('.cinema-site')?.getAttribute('data-motion') === 'paused') return;
      animations.push(entry.target.animate([{ opacity: 0, transform: 'translateY(75px) rotate(4deg) scale(.9)' }, { opacity: 1, transform: 'translateY(0) rotate(0) scale(1)' }], { duration: 850, delay: index % 6 * 65, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    }), { threshold: .08 });
    gallery.current?.querySelectorAll(':scope > button').forEach(element => observer.observe(element));
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [view, found, limit]);
  const reset = () => { setQuery(''); onCategory('all'); setStatus('all'); setRating('all'); setLimit(PAGE); };
  const filtered = query || category !== 'all' || status !== 'all' || rating !== 'all';
  const statuses = [...new Set(titles.map(statusOf))];
  return (
    <div className="library-ui">
      <div className="collection-categories" role="group" aria-label="Collection categories">{(['all', ...CATEGORIES] as const).map(value => <button key={value} aria-pressed={category === value} onClick={() => { onCategory(value); setLimit(PAGE); }}>{value === 'all' ? 'Everything' : value}<span>{value === 'all' ? titles.length : titles.filter(t => t.type === value).length}</span></button>)}</div>
      <div className="library-bar">
        <label className="search-field"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><input id="library-search" type="search" aria-label="Search the collection" placeholder="Find a story…" value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE); }} /></label>
        <label>Status<select aria-label="Filter by viewing status" value={status} onChange={event => { setStatus(event.target.value); setLimit(PAGE); }}><option value="all">Any status</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Rating<select aria-label="Filter by rating" value={rating} onChange={event => { setRating(event.target.value); setLimit(PAGE); }}><option value="all">Any rating</option><option value="9">9 & above</option><option value="10">Perfect tens</option></select></label>
        <label>Sort by<select aria-label="Sort collection" value={sort} onChange={event => { setSort(event.target.value); setLimit(PAGE); }}><option value="added">Collection order</option><option value="rating">Highest rated</option><option value="name">Title A–Z</option><option value="year">Newest release</option></select></label>
      </div>
      <div className="results-bar"><span role="status">{found.length} {found.length === 1 ? 'story' : 'stories'}{filtered && <button className="clear-filters" onClick={reset}>Clear filters ×</button>}</span><div className="view-switch" role="group" aria-label="Choose a view"><button aria-pressed={view === 'posters'} onClick={() => setView('posters')}>Gallery</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button></div></div>
      {found.length === 0 && <div className="empty-search"><p>No stories found.</p><span>Try another title or broaden your filters.</span><button className="primary" onClick={reset}>Show the whole collection ↗</button></div>}
      {view === 'posters' ? <div className="posters" ref={gallery}>{found.slice(0, limit).map(title => <button key={title.id} onPointerMove={event => { if (event.pointerType !== "mouse") return; const box = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - (event.clientY - box.top) / box.height) * 14}deg`); event.currentTarget.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - 0.5) * 16}deg`); }} onClick={() => onOpen(title)} aria-label={`Open ${title.name}, ${title.rating === null ? 'unrated' : `${title.rating} out of 10`}`}><div className="poster-art"><Poster title={title} /><span className="poster-open" aria-hidden="true">↗</span>{title.status && <span className="poster-status">{title.status}</span>}</div><div className="poster-caption"><span className="poster-name">{title.name}</span><span className="poster-score">{title.rating?.toFixed(1) ?? '—'}</span></div><span className="poster-meta">{[title.type, title.year].filter(Boolean).join(' · ')}</span></button>)}</div> : <div className="title-list"><div className="row head"><span /><span>Title</span><span>Category</span><span>Status</span><span className="number">Rating</span></div>{found.slice(0, limit).map(title => <button className="row" key={title.id} onClick={() => onOpen(title)}><Poster title={title} /><strong>{title.name}<small>{title.year}</small></strong><span>{title.type}</span><span>{title.status ?? 'Finished'}</span><span className="number">{title.rating?.toFixed(1) ?? '—'}</span></button>)}</div>}
      {found.length > limit && <div className="load-more"><button className="primary" onClick={() => setLimit(value => value + PAGE)}>More stories <span aria-hidden="true">↓</span></button><span>{Math.min(limit, found.length)} of {found.length} titles</span></div>}
    </div>
  );
}
export default memo(Library);
