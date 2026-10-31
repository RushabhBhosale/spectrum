'use client';

import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import type { Title } from '@/lib/types';

type Props = { titles: Title[]; paused: boolean; onOpen: (title: Title) => void; onActive: (title: Title) => void };

export default function PosterReel({ titles, paused, onOpen, onActive }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const live = useRef({ angle: 0, target: 0, velocity: -.025, dragging: false, startX: 0, lastX: 0, moved: false, hit: -1, x: -8, z: -5, targetX: -8, targetZ: -5, active: -1, visible: true, focused: false });
  const options = useRef({ paused, onOpen, onActive });
  useEffect(() => { options.current = { paused, onOpen, onActive }; }, [paused, onOpen, onActive]);
  const step = 360 / Math.max(1, titles.length);
  useEffect(() => {
    const state = live.current;
    let frame = 0, previous = 0;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (now: number) => {
      const dt = Math.min(34, now - (previous || now)); previous = now;
      if (state.visible && !document.hidden) {
        if (!state.dragging && !state.focused && !options.current.paused && !preference.matches) {
          state.velocity += (-.025 - state.velocity) * .025;
          state.target += state.velocity * dt;
        }
        const reduced = preference.matches;
        state.angle += (state.target - state.angle) * (reduced ? 1 : .085);
        state.x += (state.targetX - state.x) * .06;
        state.z += (state.targetZ - state.z) * .06;
        if (ring.current) ring.current.style.transform = `rotateY(${state.angle}deg)`;
        if (tilt.current) tilt.current.style.transform = `rotateX(${state.x}deg) rotateZ(${state.z}deg)`;
        const active = ((Math.round(-state.angle / step) % titles.length) + titles.length) % titles.length;
        if (active !== state.active && titles[active]) { state.active = active; options.current.onActive(titles[active]); }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const observer = new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; }, { threshold: .05 });
    if (stage.current) observer.observe(stage.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [titles, step]);
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const state = live.current;
    state.dragging = true; state.focused = false; state.moved = false; state.startX = state.lastX = event.clientX;
    state.hit = Number((event.target as HTMLElement).closest<HTMLElement>('[data-poster-index]')?.dataset.posterIndex ?? -1);
    state.target = state.angle;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const state = live.current;
    if (state.dragging) {
      const dx = event.clientX - state.lastX;
      state.target += dx * .32;
      state.velocity = Math.max(-.3, Math.min(.3, dx * .012));
      state.lastX = event.clientX;
      if (Math.abs(event.clientX - state.startX) > 6) state.moved = true;
    } else if (event.pointerType === 'mouse' && !options.current.paused) {
      const box = event.currentTarget.getBoundingClientRect();
      state.targetX = -8 + ((event.clientY - box.top) / box.height - .5) * 16;
      state.targetZ = -5 + ((event.clientX - box.left) / box.width - .5) * 10;
    }
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const state = live.current;
    if (!state.dragging) return;
    state.dragging = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state.moved && state.hit >= 0 && titles[state.hit]) onOpen(titles[state.hit]);
  };
  const turn = (direction: number) => { live.current.target = Math.round(live.current.target / step) * step + direction * step; };
  if (!titles.length) return null;
  return <div className="poster-playground">
    <div className="poster-orbit" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { live.current.dragging = false; }} onPointerLeave={() => { live.current.targetX = -8; live.current.targetZ = -5; }} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); turn(event.key === 'ArrowLeft' ? 1 : -1); } }} role="group" aria-label="Draggable 3D title reel. Drag to rotate, select a poster to open it, or use the arrow buttons.">
      <div className="orbit-tilt" ref={tilt}><div className="orbit-ring" ref={ring}>{titles.map((title, index) => <button className="orbit-card" key={title.id} data-poster-index={index} style={{ '--angle': `${index * step}deg` } as CSSProperties} aria-label={`Open ${title.name}`} onFocus={event => { if (!event.currentTarget.matches(':focus-visible')) return; live.current.focused = true; live.current.target = live.current.angle + (((-index * step - live.current.angle + 540) % 360 + 360) % 360 - 180); }} onBlur={() => { live.current.focused = false; }} onClick={event => { if (event.detail === 0) onOpen(title); }}><img src={title.poster ?? title.backdrop} alt="" draggable={false} loading={index < 4 ? 'eager' : 'lazy'} /><span>{title.name}<b>{title.rating?.toFixed(1) ?? '—'}</b></span></button>)}</div></div>
    </div>
    <div className="orbit-controls"><span>Drag the reel. Find a story.</span><div><button aria-label="Rotate reel left" onClick={() => turn(1)}>←</button><button aria-label="Rotate reel right" onClick={() => turn(-1)}>→</button></div></div>
  </div>;
}
