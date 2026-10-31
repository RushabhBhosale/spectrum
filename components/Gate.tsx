'use client';

import { useEffect, useRef, useState } from 'react';
import { SITE_LINES, SITE_NAME } from '@/lib/site';
import { gsap, prefersReducedMotion } from './motion';

const MAX_WAIT_MS = 2600;
const TITLE_LANDS_SECONDS = 0.9;
const TITLE_HOLD_SECONDS = 0.5;
const BLINDS = 9;
const ROWS = 5;
const WALL_SECONDS = 1.75;
const WARP_SECONDS = 0.62;
const WARP_CUTS = 6;

export type GateShot = { src: string; logo?: string; accent: string };

function imageReady(image: HTMLImageElement) {
  if (image.complete) return Promise.resolve();
  return new Promise<void>((resolve) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => resolve(), { once: true });
  });
}

/**
 * The opening trailer: rapid cuts with each show's logo, a tilted wall of banners racing
 * past, a warp straight through it, the title slamming in, then blinds opening on the site.
 */
export default function Gate({ shots, wall, total, onReveal }: { shots: GateShot[]; wall: string[]; total: number; onReveal: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const finish = () => setGone(true);
    if (prefersReducedMotion() || new URLSearchParams(location.search).has('title') || !shots.length) {
      onReveal();
      finish();
      return;
    }

    const q = gsap.utils.selector(element);
    const cuts = q('.gate-shot');
    if (!cuts.length) return;
    const plane = q('.gate-plane');
    const rows = q('.gate-row');
    const number = q('.gate-count');
    const count = { n: 0 };
    const paint = () => { counter.current!.textContent = String(Math.round(count.n)).padStart(3, '0'); };

    const timeline = gsap.timeline({ paused: true, onComplete: finish });

    // Rapid cuts, each one quicker than the last.
    let at = 0;
    cuts.forEach((cut, index) => {
      const hold = gsap.utils.interpolate(0.19, 0.055, index / Math.max(1, cuts.length - 1));
      const [still, logo] = [cut.children[0], cut.children[1]];
      timeline.set(cut, { visibility: 'visible' }, at);
      if (index) timeline.set(cuts[index - 1], { visibility: 'hidden' }, at);
      timeline.fromTo(still, { scale: 1.2 }, { scale: 1.02, duration: hold + 0.1, ease: 'none' }, at);
      if (logo) timeline.fromTo(logo, { scale: 1.4 }, { scale: 1, duration: Math.max(0.1, hold), ease: 'expo.out' }, at);
      at += hold;
    });
    timeline.to(count, { n: total * 0.5, duration: at, ease: 'none', onUpdate: paint }, 0);

    // The wall of banners, with each row racing the opposite way to the one above it.
    timeline.set(cuts[cuts.length - 1], { visibility: 'hidden' }, at);
    timeline.set(plane, { visibility: 'visible' }, at);
    timeline.fromTo(plane, { rotationX: 54, rotationZ: -18, scale: 0.6 }, { rotationX: 34, rotationZ: -7, scale: 1.15, duration: WALL_SECONDS, ease: 'power1.in' }, at);
    rows.forEach((row, index) => {
      const forward = index % 2 === 0;
      timeline.fromTo(row, { xPercent: forward ? -40 : 4 }, { xPercent: forward ? 4 : -40, duration: WALL_SECONDS + WARP_SECONDS, ease: 'power2.in' }, at);
    });
    timeline.to(count, { n: total * 0.93, duration: WALL_SECONDS, ease: 'none', onUpdate: paint }, at);
    timeline.to(number, { scale: 1.5, duration: WALL_SECONDS, ease: 'power2.in' }, at);
    at += WALL_SECONDS;

    // The warp: the wall rushes the camera while cuts flicker over it.
    timeline.to(plane, { scale: 7, rotationX: 0, rotationZ: 38, duration: WARP_SECONDS, ease: 'power3.in' }, at);
    timeline.to(count, { n: total, duration: WARP_SECONDS, ease: 'none', onUpdate: paint }, at);
    timeline.to(number, { scale: 9, opacity: 0, duration: WARP_SECONDS, ease: 'power3.in' }, at);
    cuts.slice(-WARP_CUTS).forEach((cut, index, group) => {
      const time = at + 0.24 + index * 0.06;
      timeline.set(cut, { visibility: 'visible' }, time);
      if (index) timeline.set(group[index - 1], { visibility: 'hidden' }, time);
    });
    at += WARP_SECONDS;
    timeline.set(cuts, { visibility: 'hidden' }, at);
    timeline.set(plane, { visibility: 'hidden' }, at);

    // A flash, then the title slams in from all sides.
    timeline.fromTo(q('.gate-flash'), { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, at);
    timeline.fromTo(q('.gate-char'), { scale: 3.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: 'expo.out', stagger: { each: 0.022, from: 'random' } }, at);
    at += TITLE_LANDS_SECONDS + TITLE_HOLD_SECONDS;

    // Blinds open from the middle onto the real page.
    timeline.call(onReveal, [], at);
    timeline.to(q('.gate-slam'), { opacity: 0, scale: 1.08, duration: 0.4, ease: 'power3.in' }, at);
    timeline.to(q('.gate-blind'), { scaleY: 0, duration: 0.95, ease: 'expo.inOut', stagger: { amount: 0.34, from: 'center' } }, at + 0.12);

    let cancelled = false;
    const images = [...element.querySelectorAll('img')];
    let loaded = 0;
    const ready = images.map((image) => imageReady(image).then(() => {
      loaded++;
      if (cancelled) return;
      count.n = (loaded / images.length) * total * 0.08;
      paint();
    }));
    Promise.race([Promise.all(ready), new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS))]).then(() => {
      if (!cancelled) timeline.play();
    });

    const hurry = () => timeline.timeScale(4);
    addEventListener('pointerdown', hurry);
    addEventListener('keydown', hurry);
    addEventListener('wheel', hurry, { passive: true });
    return () => {
      cancelled = true;
      timeline.kill();
      removeEventListener('pointerdown', hurry);
      removeEventListener('keydown', hurry);
      removeEventListener('wheel', hurry);
    };
  }, [shots, total, onReveal]);

  if (gone) return null;
  const perRow = Math.ceil(wall.length / ROWS);
  return (
    <div className="gate" ref={root} aria-hidden="true">
      <div className="gate-blinds">{Array.from({ length: BLINDS }, (_, index) => <i className="gate-blind" key={index} />)}</div>
      <div className="gate-wall">
        <div className="gate-plane">
          {Array.from({ length: ROWS }, (_, row) => (
            <div className="gate-row" key={row}>
              {wall.slice(row * perRow, (row + 1) * perRow).map((src) => <img src={src} alt="" key={src} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="gate-cuts">
        {shots.map((shot) => (
          <div className="gate-shot" key={shot.src} style={{ background: shot.accent }}>
            <img src={shot.src} alt="" />
            {shot.logo && <img className="gate-logo" src={shot.logo} alt="" />}
          </div>
        ))}
      </div>
      <p className="gate-count"><span ref={counter}>000</span></p>
      <i className="gate-flash" />
      <div className="gate-slam">
        {SITE_LINES.map((line) => (
          <span className="gate-line" key={line}>
            {[...line].map((char, index) => <span className="gate-char" key={index}>{char === ' ' ? ' ' : char}</span>)}
          </span>
        ))}
      </div>
      <span className="sr-only">{SITE_NAME}</span>
      <noscript><style>{'.gate{display:none}'}</style></noscript>
    </div>
  );
}
