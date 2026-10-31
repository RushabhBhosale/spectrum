'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SITE_LINES, SITE_OWNER } from '@/lib/site';
import type { Title } from '@/lib/types';
import { gsap, prefersReducedMotion } from './motion';
import { Roll } from './Type';

const CUT_MS = 2300;
const STILLS_PER_TITLE = 2;

type Props = {
  scenes: Title[];
  titleCount: number;
  hours: number;
  paused: boolean;
  entered: boolean;
  onOpen: (title: Title) => void;
  onScene: (title: Title) => void;
  onShuffle: () => void;
  onPause: () => void;
};

/** Stills cut like footage behind a title that stays put, until a shutter closes on scroll. */
export default function Hero({ scenes, titleCount, hours, paused, entered, onOpen, onScene, onShuffle, onPause }: Props) {
  const root = useRef<HTMLElement>(null);
  const inView = useRef(true);
  const position = useRef(0);
  const shots = useMemo(() => scenes.flatMap((title) => title.stills.slice(0, STILLS_PER_TITLE).map((src) => ({ src, title }))), [scenes]);
  const [index, setIndex] = useState(0);
  const shot = shots[index];

  useEffect(() => {
    if (shot && inView.current) onScene(shot.title);
  }, [shot, onScene]);

  useEffect(() => {
    if (paused || !entered || shots.length < 2) return;
    let waiting: HTMLImageElement | null = null;
    const timer = setInterval(() => {
      if (!inView.current || document.hidden) return;
      // Only cut once the next shot is ready, so a slow image never shows a blank frame.
      const next = (position.current + 1) % shots.length;
      const image = new Image();
      waiting = image;
      image.onload = () => {
        if (waiting !== image) return;
        position.current = next;
        setIndex(next);
      };
      image.src = shots[next].src;
    }, CUT_MS);
    return () => {
      waiting = null;
      clearInterval(timer);
    };
  }, [paused, entered, shots]);

  useEffect(() => {
    const element = root.current!;
    const observer = new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; });
    observer.observe(element);
    if (prefersReducedMotion()) return () => observer.disconnect();
    const q = gsap.utils.selector(element);
    const shutter = gsap.timeline({ scrollTrigger: { trigger: element, start: 'top top', end: 'bottom bottom', scrub: true } });
    shutter
      .to(q('.hero-bar-top'), { scaleY: 1, ease: 'none' }, 0)
      .to(q('.hero-bar-bottom'), { scaleY: 1, ease: 'none' }, 0)
      .to(q('.hero-title'), { scale: 0.82, ease: 'none' }, 0)
      .to(q('.hero-corner'), { opacity: 0, duration: 0.25, ease: 'none' }, 0);
    return () => {
      observer.disconnect();
      shutter.scrollTrigger?.kill();
      shutter.kill();
    };
  }, []);

  useEffect(() => {
    if (!entered || prefersReducedMotion()) return;
    const element = root.current!;
    const letters = element.querySelectorAll('.hero-char');
    const side = element.querySelectorAll('.hero-rise');
    const timeline = gsap.timeline();
    timeline
      .fromTo(letters, { yPercent: 115 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.03 })
      .fromTo(side, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.35);
    return () => { timeline.kill(); };
  }, [entered]);

  return (
    <header className="hero" id="top" ref={root}>
      <div className="hero-stage">
        {shot && <img className="hero-shot" key={shot.src} src={shot.src} alt="" fetchPriority="high" />}
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-title">
          <p className="hero-rise">{SITE_OWNER}’s viewing journal</p>
          <h1 aria-label={SITE_LINES.join(' ')}>
            {SITE_LINES.map((line) => (
              <span className="hero-line" aria-hidden="true" key={line}>
                {[...line].map((char, position) => <span className="hero-char" key={position}>{char === ' ' ? ' ' : char}</span>)}
              </span>
            ))}
          </h1>
          <p className="hero-rise">{titleCount} titles · {hours.toLocaleString('en-US')} hours · no regrets</p>
        </div>
        <div className="hero-corner hero-corner-left hero-rise">
          {shot && <button onClick={() => onOpen(shot.title)}><small>Now showing</small><Roll>{shot.title.name}</Roll></button>}
        </div>
        <div className="hero-corner hero-corner-right hero-rise">
          <button onClick={onShuffle}><Roll>Pick one for me</Roll></button>
          <button onClick={onPause} aria-pressed={paused}><Roll>{paused ? 'Play motion' : 'Pause motion'}</Roll></button>
        </div>
        <i className="hero-bar-top" aria-hidden="true" />
        <i className="hero-bar-bottom" aria-hidden="true" />
      </div>
    </header>
  );
}
