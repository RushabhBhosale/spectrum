'use client';

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { SITE_NAME, SITE_OWNER } from '@/lib/site';
import { CATEGORIES, isUnfinished, type Title } from '@/lib/types';
import { gsap, prefersReducedMotion } from './motion';

const ROLL_SPEED = 1.5;

/** The whole collection as real end credits, with a poster that follows the pointer. */
function Credits({ titles, hours, unfinished, onOpen }: { titles: Title[]; hours: number; unfinished: number; onOpen: (title: Title) => void }) {
  const root = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLImageElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const reels = useMemo(() => CATEGORIES.map((type) => ({
    type,
    list: titles.filter((t) => t.type === type).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name)),
  })), [titles]);
  const byId = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles]);

  useEffect(() => {
    const element = sheet.current!;
    if (prefersReducedMotion()) return;
    let tween: gsap.core.Tween | null = null;
    const build = () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      const stage = innerHeight;
      const length = element.offsetHeight;
      setHeight(Math.round(length / ROLL_SPEED + stage));
      requestAnimationFrame(() => {
        tween = gsap.fromTo(element, { y: stage * 0.22 }, {
          y: -length,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
        });
      });
    };
    build();
    addEventListener('resize', build);
    document.fonts?.ready.then(build);
    return () => {
      removeEventListener('resize', build);
      tween?.scrollTrigger?.kill();
      tween?.kill();
      gsap.set(element, { clearProps: 'transform' });
    };
  }, []);

  const hover = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const image = preview.current!;
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    const title = id ? byId.get(id) : undefined;
    if (title?.poster) {
      if (!image.src.endsWith(title.poster)) image.src = title.poster;
      image.dataset.on = 'true';
    } else {
      image.dataset.on = 'false';
    }
    gsap.to(image, { x: event.clientX + 26, y: event.clientY - 110, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
  };

  return (
    <section className="credits-roll" id="credits" ref={root} style={height ? { height } : undefined} aria-label="End credits: every title in the collection">
      <div className="credits-stage">
        <div className="credits-sheet" ref={sheet} onPointerMove={hover} onPointerLeave={() => { preview.current!.dataset.on = 'false'; }} onClick={(event) => {
          const id = (event.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
          const title = id ? byId.get(id) : undefined;
          if (title) onOpen(title);
        }}>
          <header className="credits-open">
            <p>{SITE_NAME}</p>
            <dl>
              <div><dt>Watched by</dt><dd>{SITE_OWNER}</dd></div>
              <div><dt>Running time</dt><dd>{hours.toLocaleString('en-US')} hours</dd></div>
              <div><dt>Sleep schedule</dt><dd>Not credited</dd></div>
            </dl>
          </header>
          {reels.map(({ type, list }) => list.length > 0 && (
            <div className="credits-reel" key={type}>
              <h3>{type}</h3>
              <div className="credits-names">
                {list.map((title) => (
                  <button key={title.id} data-id={title.id} tabIndex={-1} className={`credit${title.rating === 10 ? ' ten' : ''}${isUnfinished(title) ? ' left' : ''}`}>
                    {title.name}<span>{title.rating?.toFixed(1) ?? '–'}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <footer className="credits-close">
            <p>{unfinished} titles left unfinished.</p>
            <p>Some sleep was harmed in the making of this collection.</p>
          </footer>
        </div>
        <img className="credit-preview" ref={preview} alt="" data-on="false" />
      </div>
    </section>
  );
}

export default memo(Credits);
