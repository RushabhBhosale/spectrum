'use client';

import { useEffect, useRef, useState } from 'react';
import type { Title } from '@/lib/types';
import { gsap, prefersReducedMotion } from './motion';
import Poster from './Poster';

const CUT_MS = 2000;

/** Each title is a small film of its own: its stills cut behind its name in red. */
export default function TitleSheet({ title, paused, onClose }: { title: Title | null; paused: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [shot, setShot] = useState(0);
  const isOpen = Boolean(title);

  useEffect(() => {
    const element = dialog.current!;
    if (title && !element.open) element.showModal();
    if (!title && element.open) element.close();
    setCopied(false);
    setCopyError(false);
    setShot(0);
    if (!title) return;
    element.scrollTop = 0;
    if (prefersReducedMotion()) return;
    const q = gsap.utils.selector(element);
    const timeline = gsap.timeline();
    timeline
      .fromTo(q('.sheet-cover'), { clipPath: 'inset(46% 12% 46% 12%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.15, ease: 'expo.inOut' })
      .fromTo(q('.sheet-char'), { yPercent: 115 }, { yPercent: 0, duration: 1.05, ease: 'expo.out', stagger: 0.016 }, 0.55)
      .fromTo(q('.sheet-fade'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.06 }, 0.75);
    return () => { timeline.kill(); };
  }, [title]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);

  const stills = title?.stills ?? [];
  useEffect(() => {
    if (stills.length < 2 || paused || prefersReducedMotion()) return;
    let position = 0;
    let waiting: HTMLImageElement | null = null;
    const timer = setInterval(() => {
      // Only cut once the next still is ready, so a slow image never shows a blank frame.
      const next = (position + 1) % stills.length;
      const image = new Image();
      waiting = image;
      image.onload = () => {
        if (waiting !== image) return;
        position = next;
        setShot(next);
      };
      image.src = stills[next];
    }, CUT_MS);
    return () => {
      waiting = null;
      clearInterval(timer);
    };
  }, [stills, paused]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <dialog className="sheet" ref={dialog} data-lenis-prevent onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={() => { if (title) onClose(); }} aria-labelledby="sheet-title">
      {title && (
        <article className="sheet-body">
          <div className="sheet-toolbar"><button className="sheet-close" onClick={onClose} aria-label="Close title" autoFocus>Close</button></div>
          <div className="sheet-cover" style={{ background: title.accent }}>
            {stills[shot] && <img key={stills[shot]} src={stills[shot]} alt={`A scene from ${title.name}`} />}
            <div className="sheet-shade" aria-hidden="true" />
            <div className="sheet-cover-copy">
              <p className="sheet-fade">{[title.type, title.year].filter(Boolean).join(' · ')}</p>
              <h2 id="sheet-title" aria-label={title.name} className={title.name.length > 22 ? 'long' : undefined}>
                {title.name.split(' ').map((word, index) => (
                  <span className="sheet-word" aria-hidden="true" key={index}>
                    {[...word].map((char, position) => <span className="sheet-char" key={position}>{char}</span>)}
                  </span>
                ))}
              </h2>
              <p className="sheet-fade">{title.status ?? 'Finished'}</p>
            </div>
            <p className="sheet-rating sheet-fade">{title.rating === null ? 'Unrated' : <>{title.rating.toFixed(1)}<small>/10</small></>}</p>
          </div>
          <div className="sheet-details">
            <div className="sheet-side"><Poster title={title} /></div>
            <div className="sheet-text">
              {title.overview && <section className="sheet-synopsis" aria-labelledby="sheet-synopsis-title"><h3 id="sheet-synopsis-title">Synopsis</h3><p>{title.overview}</p></section>}
              {title.quote && <blockquote className="sheet-quote">“{title.quote}”</blockquote>}
              <dl className="sheet-facts">
                <div><dt>Time in this world</dt><dd>{title.hours.toLocaleString('en-US')} hours</dd></div>
                {title.genres.length > 0 && <div><dt>Genres</dt><dd>{title.genres.join(' · ')}</dd></div>}
              </dl>
              <div className="sheet-share"><button className="text-link" onClick={share}>{copied ? 'Link copied' : 'Copy title link ↗'}</button></div>
              {copyError && <p className="sheet-copy-error" role="status">Copy the address from your browser to share this title.</p>}
            </div>
          </div>
        </article>
      )}
    </dialog>
  );
}
