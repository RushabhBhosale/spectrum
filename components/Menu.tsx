'use client';

import { useEffect, useMemo, useRef } from 'react';
import { SITE_NAME } from '@/lib/site';
import { CATEGORIES, type Category, type Title } from '@/lib/types';
import { gsap, prefersReducedMotion } from './motion';
import { Roll } from './Type';

type Props = {
  open: boolean;
  titles: Title[];
  onClose: () => void;
  onCategory: (category: Category) => void;
  onSection: (selector: string) => void;
};

const UNLOCK_MS = 80;

const best = (list: Title[]) => [...list].filter((t) => t.backdrop).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.hours - a.hours)[0];

/** A full-screen red menu with one numbered row per category. */
export default function Menu({ open, titles, onClose, onCategory, onSection }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const rows = useMemo(() => CATEGORIES.map((type) => {
    const list = titles.filter((t) => t.type === type);
    return { type, count: list.length, lead: best(list) };
  }), [titles]);

  useEffect(() => {
    const element = dialog.current!;
    if (!open) {
      if (element.open) element.close();
      return;
    }
    if (!element.open) element.showModal();
    element.scrollTop = 0;
    if (prefersReducedMotion()) return;
    const q = gsap.utils.selector(element);
    const timeline = gsap.timeline();
    timeline
      .fromTo(element, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: 'expo.inOut' })
      .fromTo(q('.menu-char'), { yPercent: 112 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.02 }, 0.38)
      .fromTo(q('.menu-row'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, 0.5);
    return () => { timeline.kill(); };
  }, [open]);

  const go = (selector: string) => {
    onClose();
    // Scrolling stays locked until the menu has closed.
    setTimeout(() => onSection(selector), UNLOCK_MS);
  };

  return (
    <dialog className="menu" ref={dialog} data-lenis-prevent onCancel={(event) => { event.preventDefault(); onClose(); }} aria-label="Menu">
      <div className="menu-bar">
        <div>
          <button onClick={() => go('#tens')}><Roll>Perfect tens</Roll></button>
          <button onClick={() => go('#worlds')}><Roll>Worlds</Roll></button>
          <button onClick={() => go('#colours')}><Roll>Spectrum</Roll></button>
          <button onClick={() => go('#numbers')}><Roll>Numbers</Roll></button>
          <button onClick={() => go('#library')}><Roll>Collection</Roll></button>
          <button onClick={() => go('#credits')}><Roll>Credits</Roll></button>
        </div>
        <button onClick={onClose} autoFocus><Roll>Close</Roll></button>
      </div>
      <p className="menu-word" aria-label={SITE_NAME}>
        {[...SITE_NAME].map((char, index) => <span className="menu-mask" aria-hidden="true" key={index}><span className="menu-char">{char === ' ' ? ' ' : char}</span></span>)}
      </p>
      <div className="menu-rows">
        {rows.map((row, index) => (
          <button className="menu-row" key={row.type} onClick={() => { onCategory(row.type); go('#library'); }}>
            <span className="menu-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="menu-image">{row.lead && <img src={row.lead.backdrop!.replace('/w1280/', '/w780/')} alt="" loading="lazy" />}</span>
            <span className="menu-label"><small>{row.count} titles</small><strong>{row.type}</strong></span>
          </button>
        ))}
      </div>
    </dialog>
  );
}
