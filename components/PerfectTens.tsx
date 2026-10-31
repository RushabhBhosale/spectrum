'use client';

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { punch } from '@/lib/colour';
import { setNowShowing } from '@/lib/now-showing';
import { fitRoster } from '@/lib/roster';
import type { Title } from '@/lib/types';
import { gsap, prefersReducedMotion } from './motion';

const SLAB_RATIO = 0.6;
const CARD_GAP = 26;
const PHONE_CARD_GAP = 14;
const PHONE_WIDTH = 760;
// The table lies back from the camera, so it can hold more than the screen's own height.
const TABLE_DEPTH = 1.5;
const TABLE_DEPTH_PHONE = 1.12;
const TABLE_MARGIN = 0.92;
const TILT_DEGREES = 20;
const SWAY_AFTER_MS = 1400;
const SPINS = [-3, 2, -1, 4, -4, 1, 3, -2];

const cert = (index: number) => `OME ${String(index + 1).padStart(3, '0')}`;

/** A title sealed in a clear case, with its grade on the label. */
function Slab({ title, index, sharp }: { title: Title; index: number; sharp?: boolean }) {
  return (
    <div className="slab">
      <div className="slab-label">
        <div>
          <b>{title.year} {title.name}</b>
          <small>{title.type}</small>
          <i aria-hidden="true" />
        </div>
        <p><small>Gem mt</small><strong>10</strong><small>{cert(index)}</small></p>
      </div>
      <div className="slab-card">
        <img src={sharp ? title.poster?.replace('/w342/', '/w500/') : title.poster} alt="" draggable={false} decoding="async" />
        <i className="slab-foil" />
        <i className="slab-glare" />
      </div>
    </div>
  );
}

/**
 * Every perfect ten graded and sealed like a collector's card, laid out on one table.
 * Pick one up and it tilts in your hand, with the foil following you.
 */
function PerfectTens({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const root = useRef<HTMLElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const aimed = useRef(0);
  const [fit, setFit] = useState({ columns: 7, card: 0 });
  const [seen, setSeen] = useState(false);
  const [lifted, setLifted] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const held = picked === null ? null : titles[picked];

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const phone = innerWidth < PHONE_WIDTH;
      setFit(fitRoster(titles.length, element.clientWidth * 0.9, element.clientHeight * (phone ? TABLE_DEPTH_PHONE : TABLE_DEPTH), phone ? PHONE_CARD_GAP : CARD_GAP, SLAB_RATIO));
    };
    const sizes = new ResizeObserver(measure);
    sizes.observe(element);
    const watched = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true);
      else setPicked(null);
    }, { threshold: 0.4 });
    watched.observe(element);
    return () => {
      sizes.disconnect();
      watched.disconnect();
    };
  }, [titles.length]);

  // The table is tilted away from the camera, so its size on screen is measured, not worked out.
  useLayoutEffect(() => {
    const [section, element] = [root.current, table.current];
    if (!section || !element || !fit.card) return;
    element.style.setProperty('--scale', '1');
    element.style.setProperty('--dx', '0px');
    element.style.setProperty('--dy', '0px');
    const phone = innerWidth < PHONE_WIDTH;
    const outer = section.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const area = phone
      ? { left: 6, right: outer.width - 6, top: 132, bottom: outer.height - 42 }
      : { left: outer.width * 0.1, right: outer.width - 12, top: 44, bottom: outer.height - 44 };
    const scale = Math.min((area.right - area.left) / box.width, (area.bottom - area.top) / box.height) * TABLE_MARGIN;
    element.style.setProperty('--scale', scale.toFixed(3));
    element.style.setProperty('--dx', `${((area.left + area.right) / 2 - (box.left - outer.left + box.width / 2)).toFixed(1)}px`);
    element.style.setProperty('--dy', `${((area.top + area.bottom) / 2 - (box.top - outer.top + box.height / 2)).toFixed(1)}px`);
  }, [fit]);

  const pick = useCallback((index: number) => {
    setPicked((index + titles.length) % titles.length);
    setLifted(null);
    setNowShowing(titles[(index + titles.length) % titles.length]);
  }, [titles]);

  useEffect(() => {
    if (picked === null) return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPicked(null);
      if (event.key === 'ArrowRight') pick(picked + 1);
      if (event.key === 'ArrowLeft') pick(picked - 1);
    };
    addEventListener('keydown', keys);
    return () => removeEventListener('keydown', keys);
  }, [picked, pick]);

  // The held card sways by itself, so the foil is alive even with no pointer on it.
  useEffect(() => {
    const element = tilt.current;
    if (!element || prefersReducedMotion()) return;
    const state = { x: 0, y: 0, tx: 0, ty: 0 };
    const tick = (time: number) => {
      if (performance.now() - aimed.current > SWAY_AFTER_MS) {
        state.tx = Math.sin(time * 0.9) * 0.55;
        state.ty = Math.cos(time * 0.7) * 0.4;
      }
      state.x += (state.tx - state.x) * 0.12;
      state.y += (state.ty - state.y) * 0.12;
      element.style.setProperty('--ry', `${(state.x * TILT_DEGREES).toFixed(2)}deg`);
      element.style.setProperty('--rx', `${(-state.y * TILT_DEGREES).toFixed(2)}deg`);
      element.style.setProperty('--mx', `${(50 + state.x * 50).toFixed(1)}%`);
      element.style.setProperty('--my', `${(50 + state.y * 50).toFixed(1)}%`);
    };
    gsap.ticker.add(tick);
    const aim = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      state.tx = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
      state.ty = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
      aimed.current = performance.now();
    };
    addEventListener('pointermove', aim);
    return () => {
      gsap.ticker.remove(tick);
      removeEventListener('pointermove', aim);
    };
  }, [picked]);

  if (!titles.length) return null;
  const hovered = lifted === null ? null : titles[lifted];

  return (
    <section className="vault" id="tens" ref={root} data-seen={seen} data-held={picked !== null} aria-label={`Perfect tens, ${titles.length} titles`}>
      <i className="vault-light" />
      <div className="vault-copy">
        <h2>Perfect<br />tens</h2>
        <p>{titles.length} titles, graded and sealed. Gem mint, every one.</p>
      </div>

      <div className="vault-table" ref={table} style={{ gridTemplateColumns: `repeat(${fit.columns}, ${fit.card}px)`, '--card': `${fit.card}px` } as CSSProperties} data-ready={fit.card > 0}>
        {titles.map((title, index) => (
          <button
            key={title.id}
            className="vault-slab"
            data-out={index === picked}
            aria-label={`Pick up ${title.name}`}
            style={{ '--spin': `${SPINS[index % SPINS.length]}deg`, '--i': index } as CSSProperties}
            onPointerEnter={(event) => {
              if (event.pointerType !== 'mouse') return;
              setLifted(index);
              setNowShowing(title);
            }}
            onPointerLeave={() => setLifted(null)}
            onClick={() => pick(index)}
          >
            <Slab title={title} index={index} />
          </button>
        ))}
      </div>

      <p className="vault-hint" key={hovered?.id}>{hovered ? hovered.name : 'Pick one up'}</p>

      {held && picked !== null && (
        <div className="vault-held" onClick={() => setPicked(null)}>
          <div className="vault-hand" style={{ '--show': punch(held.accent) } as CSSProperties} onClick={(event) => event.stopPropagation()}>
            <div className="vault-tilt" ref={tilt} key={held.id}><Slab title={held} index={picked} sharp /></div>
            <div className="vault-info" key={`info-${held.id}`}>
              <p>Certified perfect · {String(picked + 1).padStart(2, '0')} of {titles.length}</p>
              <h3 data-long={held.name.length > 18}>{held.name}</h3>
              <dl>
                <div><dt>Category</dt><dd>{held.type}</dd></div>
                {held.year && <div><dt>Year</dt><dd>{held.year}</dd></div>}
                <div><dt>Hours</dt><dd>{held.hours.toLocaleString('en-US')}</dd></div>
                <div><dt>Grade</dt><dd>10</dd></div>
              </dl>
              <div className="vault-actions">
                <button className="ticket-button" onClick={() => onOpen(held)}><span>Inside the story</span><b aria-hidden="true">→</b></button>
                <button onClick={() => pick(picked - 1)} aria-label="Previous card">←</button>
                <button onClick={() => pick(picked + 1)} aria-label="Next card">→</button>
                <button onClick={() => setPicked(null)} aria-label="Put it back">✕</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(PerfectTens);
