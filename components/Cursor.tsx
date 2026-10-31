'use client';

import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './motion';

const LABELS: [string, string][] = [
  ['.posters button, .tunnel-canvas[data-hit=true], .credit, .hero-corner-left button, .ticket-main', 'Open'],
  ['.vault-slab', 'Pick up'],
];

/** A small dot trailing the pointer. It opens into a label over anything you can enter. */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current!;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || prefersReducedMotion()) return;
    const moveX = gsap.quickTo(element, 'x', { duration: 0.28, ease: 'power3' });
    const moveY = gsap.quickTo(element, 'y', { duration: 0.28, ease: 'power3' });
    const label = element.firstElementChild as HTMLElement;
    const move = (event: globalThis.PointerEvent) => {
      moveX(event.clientX);
      moveY(event.clientY);
      element.dataset.on = 'true';
      const target = event.target as Element;
      const text = LABELS.find(([selector]) => target.closest(selector))?.[1] ?? '';
      if (text) label.textContent = text;
      element.dataset.state = text ? 'label' : target.closest('a, button') ? 'link' : 'idle';
    };
    const leave = () => { element.dataset.on = 'false'; };
    addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, []);

  return <div className="cursor" ref={root} data-on="false" data-state="idle" aria-hidden="true"><span /></div>;
}
