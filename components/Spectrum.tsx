'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { hueKey, stripes } from '@/lib/colour';
import { averageRating, ORDERS, summarise, type OrderKey } from '@/lib/stats';
import { CATEGORIES, type Category, type Title } from '@/lib/types';
import Insights from './Insights';
import Library from './Library';
import Poster from './Poster';
import Ratings from './Ratings';
import TitleSheet from './TitleSheet';
import Wall from './Wall';

type Filter = 'all' | Category;
const number = (value: number) => Math.round(value).toLocaleString('en-US');

export default function Spectrum({ titles, placeholders }: { titles: Title[]; placeholders: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [orderKey, setOrderKey] = useState<OrderKey>('colour');
  const [hovered, setHovered] = useState<Title | null>(null);
  const [open, setOpen] = useState<Title | null>(null);

  const visible = useMemo(
    () => titles.filter((t) => filter === 'all' || t.type === filter).sort(ORDERS[orderKey].sort),
    [titles, filter, orderKey],
  );
  const stats = useMemo(() => summarise(visible), [visible]);
  const best = useMemo(() => [...visible].sort(ORDERS.rating.sort)[0] ?? null, [visible]);
  const tens = useMemo(() => visible.filter((t) => t.rating === 10).sort((a, b) => b.hours - a.hours), [visible]);
  const quotes = useMemo(() => visible.filter((t) => t.quote), [visible]);
  const reels = useMemo(
    () =>
      CATEGORIES.map((type) => {
        const list = titles.filter((t) => t.type === type);
        return {
          type,
          count: list.length,
          hours: list.reduce((sum, t) => sum + t.hours, 0),
          average: averageRating(list),
          colours: list.map((t) => t.accent).sort((a, b) => hueKey(a) - hueKey(b)),
        };
      }),
    [titles],
  );
  const widestReel = Math.max(1, ...reels.map((r) => r.count));
  const orderKeys = (Object.keys(ORDERS) as OrderKey[]).filter((key) => key !== 'year' || titles.some((t) => t.year));

  const shown = hovered ?? best;
  const details = shown && [shown.type, shown.year, `${number(shown.hours)} hours`, shown.status].filter(Boolean).join(' · ');

  // Each title has its own link, and the back button closes it.
  const openTitle = useCallback((title: Title) => {
    setOpen(title);
    history.pushState(null, '', `?title=${title.id}`);
  }, []);
  const closeTitle = useCallback(() => {
    setOpen(null);
    if (location.search) history.pushState(null, '', location.pathname);
  }, []);
  useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(location.search).get('title');
      setOpen(titles.find((t) => t.id === id) ?? null);
    };
    sync();
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, [titles]);

  const toggleFilter = (next: Filter) => setFilter(next === filter ? 'all' : next);

  return (
    <>
      <nav className="wrap nav" aria-label="Sections">
        <a href="#top">Spectrum</a>
        <div>
          {tens.length > 0 && <a href="#tens">Perfect tens</a>}
          {quotes.length > 0 && <a href="#quotes">Quotes</a>}
          <a href="#numbers">Numbers</a>
          <a href="#library">Library</a>
        </div>
      </nav>

      <header className="wrap hero" id="top">
        <div className="label">{filter === 'all' ? "Frames I've watched" : `${filter} frames I've watched`}</div>
        <h1 className="frames">{number(stats.frames)}</h1>
        <div className="stats">
          <div><b>{number(stats.count)}</b><span className="label">Titles</span></div>
          <div><b>{number(stats.hours)}</b><span className="label">Hours</span></div>
          <div><b>{number(stats.days)}</b><span className="label">Days in the dark</span></div>
          <div><b>{stats.average.toFixed(1)}</b><span className="label">Average rating</span></div>
          <div><b>{number(stats.unfinished)}</b><span className="label">Left unfinished</span></div>
          <div>
            <b>
              {stats.topColour && <span className="swatch" style={{ background: stats.topColour.hex }} />}
              {stats.topColour?.name ?? 'None yet'}
            </b>
            <span className="label">Most-watched colour</span>
          </div>
        </div>
      </header>

      <div className="wrap controls">
        <div className="group" role="group" aria-label="Filter by category">
          {(['all', ...CATEGORIES] as Filter[]).map((option) => (
            <button key={option} aria-pressed={filter === option} onClick={() => toggleFilter(option)}>
              {option === 'all' ? 'All' : option}
            </button>
          ))}
        </div>
        <div className="group" role="group" aria-label="Order titles">
          <span className="label">Order by</span>
          {orderKeys.map((key) => (
            <button key={key} aria-pressed={orderKey === key} onClick={() => setOrderKey(key)}>
              {ORDERS[key].label}
            </button>
          ))}
        </div>
      </div>

      <Wall all={titles} visible={visible} group={ORDERS[orderKey].group} onFocus={setHovered} onPick={openTitle} />

      <section className="band" aria-label="Title on screen">
        {shown?.backdrop && <img className="band-still" src={shown.backdrop} alt="" />}
        <div className="wrap band-inner">
          <div className="band-text">
            <div className="label">{shown ? (hovered ? 'On screen' : 'Highest rated') : 'Nothing here yet'}</div>
            <h2>{shown?.name ?? 'Add a title'}</h2>
            {details && <div className="label">{details}</div>}
            {shown?.quote && <p>{shown.quote}</p>}
            {shown && <button className="band-open" onClick={() => openTitle(shown)}>Open title</button>}
          </div>
          {shown && (shown.rating === null
            ? <div className="score unrated">Unrated</div>
            : <div className="score">{shown.rating.toFixed(1)}<small>/10</small></div>)}
        </div>
      </section>

      {tens.length > 0 && (
        <section className="section" id="tens">
          <h3 className="wrap">Perfect tens</h3>
          <div className="wrap shelf">
            {tens.map((title) => (
              <button key={title.id} onClick={() => openTitle(title)}>
                <Poster title={title} />
                <span className="poster-name">{title.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="wrap section" id="quotes">
          <h3>Lines that stayed</h3>
          <div className="quotes">
            {quotes.map((title) => (
              <button key={title.id} onClick={() => openTitle(title)} style={{ borderColor: title.accent }}>
                <q>{title.quote}</q>
                <span className="label">{[title.quoteBy, title.name].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="wrap section" id="numbers">
        <h3>The six reels</h3>
        {reels.map((reel) => (
          <button
            key={reel.type}
            className={`reel ${filter !== 'all' && filter !== reel.type ? 'dim' : ''}`}
            aria-pressed={filter === reel.type}
            onClick={() => toggleFilter(reel.type)}
          >
            <strong>{reel.type}</strong>
            <i style={{ width: `${(reel.count / widestReel) * 100}%`, background: reel.count ? stripes(reel.colours) : 'none' }} />
            <span>{reel.count} titles · {number(reel.hours)} h · {reel.average.toFixed(1)}</span>
          </button>
        ))}

        <h3 className="sub">How I rate</h3>
        <Ratings titles={visible} />

        <h3 className="sub">Superlatives</h3>
        <Insights titles={visible} onOpen={openTitle} />
      </section>

      <section className="wrap section" id="library">
        <h3>{filter === 'all' ? 'The library' : `${filter} library`}</h3>
        <Library titles={visible} onOpen={openTitle} />
      </section>

      <footer className="wrap">
        <span>Hours are estimates. {placeholders > 0 && `${placeholders} ${placeholders === 1 ? 'title uses' : 'titles use'} placeholder colours. `}</span>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
      </footer>

      <TitleSheet title={open} onClose={closeTitle} />
    </>
  );
}
