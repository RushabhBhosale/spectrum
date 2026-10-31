'use client';

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { colourName, hueKey } from '@/lib/colour';
import { setNowShowing } from '@/lib/now-showing';
import type { Title } from '@/lib/types';
import { prefersReducedMotion } from './motion';
import { RiseText } from './Type';

// The part of the scroll that belongs to the opening title, before the film starts.
const OPENING = 0.05;
const KEEP_ROUGH = 30;
const FORGET_AFTER = 70;
const SHARP_AHEAD = 26;
const SHARP_BEHIND = 8;
const SETTLE_MS = 130;
const PHONE_WIDTH = 760;
const BAR_STEP = 4;

const rough = (title: Title) => title.backdrop!.replace('/w1280/', '/w300/');
const sharp = (title: Title) => title.backdrop!.replace('/w1280/', '/w780/');

/** Every title, full screen, in colour order. Scrolling runs the film. */
function ColourSection({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const film = useMemo(() => titles.filter((title) => title.backdrop).sort((a, b) => hueKey(a.accent) - hueKey(b.accent)), [titles]);
  const bar = useMemo(() => `linear-gradient(90deg,${film.filter((_, index) => index % BAR_STEP === 0).map((title) => title.accent).join(',')})`, [film]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const [section, frame, screen] = [root.current, stage.current, canvas.current];
    if (!section || !frame || !screen || !film.length) return;
    const ctx = screen.getContext('2d')!;
    const phone = innerWidth < PHONE_WIDTH;
    const still = prefersReducedMotion();
    const roughs = new Map<number, HTMLImageElement>();
    const sharps = new Map<number, HTMLImageElement>();
    const finest = new Map<number, HTMLImageElement>();
    const decoded = new WeakSet<HTMLImageElement>();
    let current = 0;
    let heading = 1;
    let nearby = false;
    let settle = 0;

    const ready = (image?: HTMLImageElement) => Boolean(image && decoded.has(image));
    const draw = () => {
      const image = [finest, sharps, roughs].map((store) => store.get(current)).find(ready);
      if (!image) return;
      const scale = Math.max(screen.width / image.naturalWidth, screen.height / image.naturalHeight);
      const [width, height] = [image.naturalWidth * scale, image.naturalHeight * scale];
      ctx.drawImage(image, (screen.width - width) / 2, (screen.height - height) / 2, width, height);
    };
    const load = (store: Map<number, HTMLImageElement>, at: number, src: string) => {
      if (store.has(at)) return;
      const image = new Image();
      image.src = src;
      store.set(at, image);
      // Decoded here, so drawing it mid-scroll never holds up a frame.
      image.decode().then(() => {
        decoded.add(image);
        if (at === current) draw();
      }).catch(() => {});
    };
    const inReach = (at: number) => {
      const ahead = (at - current) * heading;
      return ahead >= -SHARP_BEHIND && ahead <= SHARP_AHEAD;
    };
    // Small pictures only cover a very fast scroll. The sharp ones stay loaded ahead of it, nearest first.
    const gather = () => {
      if (!nearby) return;
      for (let at = Math.max(0, current - KEEP_ROUGH); at <= Math.min(film.length - 1, current + KEEP_ROUGH); at++) load(roughs, at, rough(film[at]));
      for (let step = 0; step <= SHARP_AHEAD; step++) {
        for (const at of [current + step * heading, current - step * heading]) {
          if (at >= 0 && at < film.length && inReach(at)) load(sharps, at, sharp(film[at]));
        }
      }
      for (const store of [roughs, sharps]) {
        for (const [at, image] of store) {
          if (store === sharps ? inReach(at) : Math.abs(at - current) <= FORGET_AFTER) continue;
          image.src = '';
          store.delete(at);
        }
      }
    };
    // On a big screen the largest picture takes over once the scroll stops.
    const rest = () => {
      if (!phone) {
        for (const [at, image] of finest) {
          if (at === current) continue;
          image.src = '';
          finest.delete(at);
        }
        load(finest, current, film[current].backdrop!);
      }
      draw();
      setNowShowing(film[current]);
    };
    const go = (next: number) => {
      if (next === current) return;
      heading = next > current ? 1 : -1;
      current = next;
      setIndex(next);
      gather();
      if (!still) draw();
      clearTimeout(settle);
      settle = window.setTimeout(rest, SETTLE_MS);
    };
    const size = () => {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      screen.width = Math.round(screen.clientWidth * dpr);
      screen.height = Math.round(screen.clientHeight * dpr);
      draw();
    };

    const sizes = new ResizeObserver(size);
    sizes.observe(screen);
    const near = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      if (nearby) {
        gather();
        rest();
      }
    }, { rootMargin: '120% 0px' });
    near.observe(section);
    // Measured live on every scroll, so the film always runs to its last title
    // even if something on the page changes height.
    const follow = () => {
      const box = section.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -box.top / (box.height - innerHeight)));
      frame.style.setProperty('--opening', String(Math.max(0, 1 - progress / OPENING)));
      go(Math.round((Math.max(0, progress - OPENING) / (1 - OPENING)) * (film.length - 1)));
    };
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', follow);
    follow();
    return () => {
      clearTimeout(settle);
      sizes.disconnect();
      near.disconnect();
      removeEventListener('scroll', follow);
      removeEventListener('resize', follow);
    };
  }, [film]);

  const title = film[index];
  if (!title) return null;
  return (
    <section className="spectrum" id="colours" ref={root} aria-label="The spectrum: every title in colour order">
      <div className="spectrum-stage" ref={stage}>
        <canvas className="spectrum-screen" ref={canvas} aria-hidden="true" style={{ background: title.accent }} />
        <i className="spectrum-shade" />
        <div className="spectrum-opening">
          <RiseText as="h2" className="spectrum-heading" lines={['The', 'spectrum']} />
          <p>Everything I&apos;ve watched, in colour order. Keep scrolling.</p>
        </div>
        <div className="spectrum-title">
          <p>{colourName(title.accent)} · {[title.type, title.year].filter(Boolean).join(' · ')}</p>
          <button className={title.name.length > 22 ? 'long' : undefined} onClick={() => onOpen(title)}>{title.name}</button>
          <strong>{title.rating?.toFixed(1) ?? '–'}</strong>
        </div>
        <div className="spectrum-bar" style={{ background: bar }} aria-hidden="true">
          <i style={{ left: `${(index / Math.max(1, film.length - 1)) * 100}%` } as CSSProperties} />
        </div>
      </div>
    </section>
  );
}

export default memo(ColourSection);
