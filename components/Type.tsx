'use client';

import { useEffect, useRef, type CSSProperties, type ElementType } from 'react';
import { gsap, prefersReducedMotion } from './motion';

const chars = (text: string) => [...text];

/** Each letter sits on top of its twin, and the pair rolls upward on hover. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll" aria-label={children}>
      {chars(children).map((char, index) => (
        <span className="roll-char" aria-hidden="true" key={index} style={{ '--i': index } as CSSProperties}>
          <b>{char === ' ' ? ' ' : char}</b>
          <b>{char === ' ' ? ' ' : char}</b>
        </span>
      ))}
    </span>
  );
}

/** A headline whose letters rise out of a mask when it scrolls into view. */
export function RiseText({ as: Tag = 'h2', lines, className, delay = 0 }: { as?: ElementType; lines: string[]; className?: string; delay?: number }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || prefersReducedMotion()) return;
    const letters = element.querySelectorAll('.rise-char');
    gsap.set(letters, { yPercent: 112 });
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      gsap.to(letters, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.024, delay });
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      gsap.killTweensOf(letters);
      gsap.set(letters, { clearProps: 'transform' });
    };
  }, [delay]);
  return (
    <Tag ref={root} className={className} aria-label={lines.join(' ')}>
      {lines.map((line, index) => (
        <span className="rise-line" aria-hidden="true" key={index}>
          {chars(line).map((char, position) => <span className="rise-char" key={position}>{char === ' ' ? ' ' : char}</span>)}
        </span>
      ))}
    </Tag>
  );
}

/** Counts up to a number the first time it's seen. */
export function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const root = useRef<HTMLSpanElement>(null);
  const format = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  useEffect(() => {
    const element = root.current;
    if (!element || prefersReducedMotion()) return;
    const counter = { n: 0 };
    element.textContent = format(0);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      gsap.to(counter, { n: value, duration: 2.1, ease: 'expo.out', onUpdate: () => { element.textContent = format(counter.n); } });
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      gsap.killTweensOf(counter);
      element.textContent = format(value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);
  return <span ref={root}>{format(value)}</span>;
}

/** A sentence that lights up word by word as it's scrolled past. */
export function ScrubText({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || prefersReducedMotion()) return;
    const words = element.querySelectorAll('span');
    const tween = gsap.fromTo(words, { opacity: 0.12 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.1,
      scrollTrigger: { trigger: element, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(words, { clearProps: 'opacity' });
    };
  }, []);
  return <p ref={root} className={className}>{text.split(' ').map((word, index) => <span key={index}>{word} </span>)}</p>;
}
