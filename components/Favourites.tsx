'use client';

import { useEffect, useRef, useState } from 'react';
import type { Title } from '@/lib/types';
import Poster from './Poster';

export default function Favourites({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const [active, setActive] = useState(0);
  const shelf = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = shelf.current;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0, last = 0, direction = 1, inside = false, held = false;
    const site = element.closest('.cinema-site');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new IntersectionObserver(([entry]) => { inside = entry.isIntersecting; }, { threshold: .1 });
    observer.observe(element);
    const hold = () => { held = true; };
    const release = () => { held = false; };
    element.addEventListener('pointerenter', hold); element.addEventListener('pointerleave', release);
    element.addEventListener('touchstart', hold, { passive: true }); element.addEventListener('touchend', release);
    element.addEventListener('focusin', hold); element.addEventListener('focusout', release);
    const move = (now: number) => {
      const dt = Math.min(32, now - (last || now)); last = now;
      const paused = preference.matches || site?.getAttribute('data-motion') === 'paused';
      if (inside && !held && !paused && !document.hidden) {
        element.style.scrollSnapType = 'none';
        const max = element.scrollWidth - element.clientWidth;
        if (element.scrollLeft >= max - 1) direction = -1;
        if (element.scrollLeft <= 1) direction = 1;
        element.scrollLeft += direction * dt * .04;
      }
      frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('pointerenter', hold); element.removeEventListener('pointerleave', release); element.removeEventListener('touchstart', hold); element.removeEventListener('touchend', release); element.removeEventListener('focusin', hold); element.removeEventListener('focusout', release); };
  }, []);
  const title = titles[active] ?? titles[0];
  if (!title) return null;
  return (
    <section className="favourites dark-section" id="tens">
      <div className="section-heading wrap" data-reveal>
        <h2>THE KEEPERS.</h2>
        
      </div>
      <div className="favourite-feature wrap" data-reveal>
        <button className="feature-image" onClick={() => onOpen(title)} aria-label={`Open ${title.name}`}>
          <img data-parallax key={title.id} src={title.backdrop ?? title.poster} alt={`A scene from ${title.name}`} loading="lazy" />
          <span className="image-action" aria-hidden="true">↗</span>
        </button>
        <div className="feature-copy" key={`copy-${title.id}`}>
          <h3 className={title.name.length > 26 ? "long-title" : undefined}>{title.name}</h3>
          <div className="feature-ten" aria-label="Rated ten out of ten">10<span>/10</span></div><p className="feature-meta">{title.type} {title.year && `· ${title.year}`}</p>
          <p className="feature-review">{title.review || (title.quote ? `“${title.quote}”` : `${title.hours.toLocaleString('en-US')} hours in this world. Rated 10 out of 10.`)}</p>
          <button className="text-link" onClick={() => onOpen(title)}>Inside the story <span aria-hidden="true">↗</span></button>
          <div className="feature-palette" aria-label="Colours from the screen">{title.colours.map((colour, i) => <span key={i} style={{ background: colour }} />)}</div>
        </div>
      </div>
      <div className="shelf-heading wrap"><span>All {titles.length} perfect tens</span><div className="shelf-arrows"><button aria-label="Previous favourites" onClick={() => shelf.current?.scrollBy({ left: -480, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>←</button><button aria-label="Next favourites" onClick={() => shelf.current?.scrollBy({ left: 480, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>→</button></div></div>
      <div className="shelf wrap" ref={shelf}>
        {titles.map((item, index) => <button key={item.id} aria-pressed={active === index} onClick={() => setActive(index)} aria-label={`Feature ${item.name}`}><Poster title={item} /><span className="poster-name">{item.name}</span></button>)}
      </div>
    </section>
  );
}
