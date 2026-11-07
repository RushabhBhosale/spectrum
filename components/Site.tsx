'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hueKey, stripes } from '@/lib/colour';
import { setNowShowing } from '@/lib/now-showing';
import { OWNER_URL, SISTER_SITE, SITE_LINES, SITE_NAME, SITE_OWNER } from '@/lib/site';
import { averageRating, summarise } from '@/lib/stats';
import { CATEGORIES, type Category, type Title } from '@/lib/types';
import ColourSection from './ColourSection';
import Credits from './Credits';
import Cursor from './Cursor';
import Gate, { type GateShot } from './Gate';
import Hero from './Hero';
import Insights from './Insights';
import Library from './Library';
import Menu from './Menu';
import { holdScroll, prefersReducedMotion, scrollToSection, ScrollTrigger, startSmoothScroll } from './motion';
import PerfectTens from './PerfectTens';
import QuoteReel from './QuoteReel';
import Ratings from './Ratings';
import Ticket from './Ticket';
import TitleSheet from './TitleSheet';
import Tunnel from './Tunnel';
import { Count, RiseText, Roll, ScrubText } from './Type';

const HERO_PICKS = ['Violet Evergarden', 'Reply 1988', 'Death Note', 'Our Beloved Summer', 'Bleach', 'Hidden Love', 'One Piece', 'Vincenzo', 'A Silent Voice', 'First Love', 'Naruto', 'The First Frost'];
const LOADER_CUTS = 16;
const LOADER_WALL = 45;

const WORLD_COUNT = 54;

/** Nine-and-above shows, spread evenly and ordered by colour so the tunnel's light drifts. */
function pickWorlds(titles: Title[]) {
  const pool = titles.filter((t) => t.poster && t.rating !== null && t.rating >= 9 && t.rating < 10).sort((a, b) => a.name.localeCompare(b.name));
  const step = Math.max(1, pool.length / WORLD_COUNT);
  const chosen = Array.from({ length: Math.min(WORLD_COUNT, pool.length) }, (_, index) => pool[Math.floor(index * step)]);
  return chosen.sort((a, b) => hueKey(a.accent) - hueKey(b.accent));
}

/** Banners for the opening: the best of every category, then a wide spread for the racing wall. */
function pickLoader(scenes: Title[], titles: Title[]) {
  const leads = CATEGORIES.flatMap((type) => titles.filter((t) => t.type === type && t.logo && t.backdrop).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.hours - a.hours).slice(0, 2));
  const pool = [...new Set([...scenes.filter((t) => t.logo), ...leads])].slice(0, LOADER_CUTS);
  const shots: GateShot[] = pool.map((title) => ({ src: (title.stills[1] ?? title.stills[0] ?? title.backdrop!).replace('/w1280/', '/w780/'), logo: title.logo, accent: title.accent }));
  const rated = titles.filter((t) => t.stills.length).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const step = Math.max(1, Math.floor(rated.length / LOADER_WALL));
  const wall = Array.from({ length: Math.min(LOADER_WALL, rated.length) }, (_, index) => rated[index * step].stills[0].replace('/w1280/', '/w300/'));
  return { shots, wall };
}

export default function Site({ titles, placeholders }: { titles: Title[]; placeholders: number }) {
  const [motionPaused, setMotionPaused] = useState(false);
  const [entered, setEntered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overLight, setOverLight] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<'all' | Category>('all');
  const [open, setOpen] = useState<Title | null>(null);
  const lastRandom = useRef<string | null>(null);
  const titleHistory = useRef(false);

  const stats = useMemo(() => summarise(titles), [titles]);
  const tens = useMemo(() => titles.filter((t) => t.rating === 10), [titles]);
  const reelFrames = useMemo(() => tens.filter((t) => t.backdrop), [tens]);
  const worlds = useMemo(() => pickWorlds(titles), [titles]);
  const quotes = useMemo(() => titles.filter((t) => t.quote), [titles]);
  const scenes = useMemo(() => {
    const picks = HERO_PICKS.flatMap((name) => titles.find((t) => t.name === name && t.stills.length) ?? []);
    return picks.length > 3 ? picks : titles.filter((t) => t.stills.length).slice(0, 12);
  }, [titles]);
  const loader = useMemo(() => pickLoader(scenes, titles), [scenes, titles]);
  const reels = useMemo(() => CATEGORIES.map((type) => {
    const list = titles.filter((t) => t.type === type);
    return { type, count: list.length, average: averageRating(list), colours: list.map((t) => t.accent).sort((a, b) => hueKey(a) - hueKey(b)) };
  }), [titles]);
  const widestReel = Math.max(1, ...reels.map((r) => r.count));

  const openTitle = useCallback((title: Title) => {
    setOpen(title);
    const url = new URL(location.href);
    url.searchParams.set('title', title.id);
    if (new URL(location.href).searchParams.has('title')) history.replaceState(null, '', url);
    else {
      history.pushState(null, '', url);
      titleHistory.current = true;
    }
  }, []);
  const closeTitle = useCallback(() => {
    setOpen(null);
    if (titleHistory.current) {
      titleHistory.current = false;
      history.back();
    } else if (new URL(location.href).searchParams.has('title')) {
      const url = new URL(location.href);
      url.searchParams.delete('title');
      history.replaceState(null, '', url);
    }
  }, []);
  const shuffle = useCallback(() => {
    const pool = titles.filter((t) => t.id !== lastRandom.current);
    const selected = pool[Math.floor(Math.random() * pool.length)] ?? titles[0];
    if (selected) {
      lastRandom.current = selected.id;
      openTitle(selected);
    }
  }, [titles, openTitle]);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const finishGate = useCallback(() => {
    setEntered(true);
    ScrollTrigger.refresh();
  }, []);

  useEffect(() => {
    const sync = () => {
      const id = new URLSearchParams(location.search).get('title');
      setOpen(titles.find((t) => t.id === id) ?? null);
      if (!id) titleHistory.current = false;
    };
    sync();
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, [titles]);

  useEffect(() => {
    if (prefersReducedMotion()) setMotionPaused(true);
    return startSmoothScroll();
  }, []);

  useEffect(() => {
    holdScroll(!entered || menuOpen || Boolean(open));
  }, [entered, menuOpen, open]);

  // The light logo turns dark while it's passing over a light section.
  useEffect(() => {
    const light = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? light.add(entry.target) : light.delete(entry.target)));
      setOverLight(light.size > 0);
    }, { rootMargin: '-40px 0px -92% 0px' });
    document.querySelectorAll('.numbers, .quotes-section, .site-footer').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [quotes.length]);

  return (
    <div className="cinema-site" data-motion={motionPaused ? 'paused' : 'playing'} data-entered={entered} data-over-light={overLight}>
      <Gate shots={loader.shots} wall={loader.wall} total={titles.length} onReveal={finishGate} />
      <Cursor />
      <a className="skip-link" href="#library">Skip to the collection</a>
      <a className="brand" href="#top" aria-label={`${SITE_NAME}, back to top`}>{SITE_LINES[0]}<br />{SITE_LINES[1]}</a>
      <Ticket onOpen={openTitle} onMenu={openMenu} />
      <Menu open={menuOpen} titles={titles} onClose={closeMenu} onCategory={setLibraryCategory} onSection={scrollToSection} />

      <main>
        <Hero scenes={scenes} titleCount={titles.length} hours={stats.hours} paused={motionPaused || Boolean(open)} entered={entered} onOpen={openTitle} onScene={setNowShowing} onShuffle={shuffle} onPause={() => setMotionPaused((value) => !value)} />

        <section className="statement wrap" aria-label="About the collection">
          <ScrubText className="statement-big" text="Good stories. Bad sleep schedule." />
          <div className="statement-side">
            <p>From the first episode to the end credits. This is a record of what I’ve watched, how I rated it, and the stories I’m still making my way through.</p>
            <p className="statement-hours"><strong><Count value={stats.hours} /></strong><span>hours of stories and counting</span></p>
          </div>
        </section>

        <PerfectTens titles={reelFrames} onOpen={openTitle} />

        <Tunnel titles={worlds} onOpen={openTitle} />

        {quotes.length > 0 && (
          <section className="quotes-section wrap" id="quotes">
            <RiseText as="h2" className="display" lines={['Words', 'that stay']} />
            <QuoteReel titles={quotes} onOpen={openTitle} />
          </section>
        )}

        <ColourSection titles={titles} onOpen={openTitle} />

        <section className="numbers wrap" id="numbers">
          <RiseText as="h2" className="display" lines={['The big', 'picture']} />
          <div className="number-grid">
            <div><strong><Count value={stats.count} /></strong><span>titles across six kinds of storytelling</span></div>
            <div><strong><Count value={stats.average} decimals={1} /></strong><span>average rating out of ten</span></div>
            <div><strong><Count value={stats.days} /></strong><span>days spent in other worlds</span></div>
            <div><strong><Count value={stats.unfinished} /></strong><span>left unfinished, no apologies</span></div>
          </div>
          <div className="reels">
            {reels.map((reel) => <a href="#library" className="reel" key={reel.type} onClick={() => setLibraryCategory(reel.type)}><div><strong>{reel.type}</strong><span>{reel.count} titles · {reel.average.toFixed(1)} average</span></div><i style={{ width: `${(reel.count / widestReel) * 100}%`, background: stripes(reel.colours) }} /></a>)}
          </div>
          <details className="more-stats">
            <summary>Explore the numbers <span aria-hidden="true">+</span></summary>
            <div className="stats-detail">
              <h3>How I rate</h3><Ratings titles={titles} />
              <h3>Superlatives</h3><Insights titles={titles} onOpen={openTitle} />
              <p className="muted">{stats.frames.toLocaleString('en-US')} estimated frames at 24 fps · {stats.topColour?.name ?? 'No'} most-watched colour · Time is estimated from episodes and runtimes.</p>
            </div>
          </details>
        </section>

        <section className="collection wrap" id="library">
          <div className="collection-head"><RiseText as="h2" className="display" lines={['The', 'collection']} /><p>{titles.length} titles, and room for the next obsession.</p></div>
          <Library titles={titles} onOpen={openTitle} category={libraryCategory} onCategory={setLibraryCategory} />
        </section>
      </main>

      <Credits titles={titles} hours={stats.hours} unfinished={stats.unfinished} onOpen={openTitle} />

      <footer className="site-footer">
        <div className="wrap footer-top"><RiseText as="p" className="display" lines={['To be', 'continued']} /><button className="ticket-button dark" onClick={shuffle}><span>Pick one for me</span><b aria-hidden="true">→</b></button></div>
        <p className="footer-word" aria-hidden="true">{SITE_NAME}</p>
        <div className="wrap footer-bottom">
          <span>A personal collection by <a href={OWNER_URL} target="_blank" rel="noopener">{SITE_OWNER}</a>.</span>
          <a href="/studio"><Roll>Manage collection</Roll></a>
          <a href="#top"><Roll>Back to top</Roll></a>
        </div>
        <p className="wrap credits">Artwork and title information from TMDB and <a href="https://www.tvmaze.com/" target="_blank" rel="noopener">TVmaze</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.{placeholders > 0 && ` ${placeholders} ${placeholders === 1 ? 'title uses' : 'titles use'} a placeholder palette.`} Also by {SITE_OWNER}: <a href={SISTER_SITE.url} target="_blank" rel="noopener">{SISTER_SITE.name}</a>.</p>
      </footer>

      <TitleSheet title={open} paused={motionPaused} onClose={closeTitle} />
    </div>
  );
}
