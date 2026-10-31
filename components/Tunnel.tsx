'use client';

import { memo, useEffect, useRef, useState, type PointerEvent } from 'react';
import { setNowShowing } from '@/lib/now-showing';
import type { Title } from '@/lib/types';
import { prefersReducedMotion, ScrollTrigger } from './motion';
import { startTunnel, type TunnelScene } from './tunnel-gl';
import { RiseText } from './Type';

const SPACING = 250;
const LAST_PASS = 760;
const GOLDEN_ANGLE = 2.39996;

// Spiralled around the centre, leaving a clear path for the heading.
function place(index: number) {
  const angle = index * GOLDEN_ANGLE;
  const reach = 0.72 + 0.28 * Math.sin(index * 1.7) ** 2;
  return { x: Math.cos(angle) * reach * 37, y: Math.sin(angle) * reach * 31, z: -index * SPACING };
}

/** A flight through posters. Scrolling moves the camera, and the room takes each poster's colour. */
function Tunnel({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const scene = useRef<TunnelScene | null>(null);
  const [plain, setPlain] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element || !canvas.current) return;
    if (prefersReducedMotion()) {
      setPlain(true);
      return;
    }
    const depth = (titles.length - 1) * SPACING + LAST_PASS;
    let lit = -1;
    let fade = -1;
    const started = startTunnel(
      canvas.current,
      titles.map((title, index) => ({ src: title.poster!, accent: title.accent, ...place(index) })),
      {
        phone: innerWidth < 760,
        onFrame: (camera) => {
          const passed = Math.max(0, Math.min(titles.length - 1, Math.round(camera / SPACING)));
          if (passed !== lit) {
            lit = passed;
            counter.current!.textContent = String(passed + 1).padStart(2, '0');
            setNowShowing(titles[passed]);
            started?.setRoom(titles[passed].accent);
          }
          const nextFade = Math.round(Math.max(0, Math.min(1, 1.25 - (camera / depth) * 4)) * 50) / 50;
          if (nextFade !== fade) {
            fade = nextFade;
            heading.current!.style.opacity = String(nextFade);
          }
        },
      },
    );
    if (!started) {
      setPlain(true);
      return;
    }
    scene.current = started;
    started.setRoom(titles[0].accent);
    const nearby = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      started.load();
      nearby.disconnect();
    }, { rootMargin: '150% 0px' });
    nearby.observe(element);
    const seen = new IntersectionObserver(([entry]) => started.setVisible(entry.isIntersecting));
    seen.observe(element);
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => started.seek(self.progress * depth),
    });
    return () => {
      nearby.disconnect();
      seen.disconnect();
      trigger.kill();
      started.destroy();
      scene.current = null;
    };
  }, [titles]);

  const hover = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== 'mouse') return;
    const index = scene.current?.pick(event.clientX, event.clientY) ?? -1;
    event.currentTarget.dataset.hit = String(index >= 0);
    if (index >= 0) setNowShowing(titles[index]);
  };

  if (plain) {
    return (
      <section className="tunnel-plain wrap" id="worlds">
        <RiseText as="h2" className="display" lines={['Worlds I', 'got lost in']} />
        <div className="tunnel-grid">
          {titles.slice(0, 12).map((title) => <button key={title.id} onClick={() => onOpen(title)} aria-label={`Open ${title.name}`}><img src={title.poster} alt="" loading="lazy" /></button>)}
        </div>
      </section>
    );
  }

  return (
    <section className="tunnel" id="worlds" ref={root} aria-label="Worlds I got lost in. Nine and above, one step below perfect.">
      <div className="tunnel-stage">
        <div className="tunnel-heading" ref={heading}>
          <RiseText as="h2" className="display" lines={['Worlds I', 'got lost in']} />
        </div>
        <canvas
          className="tunnel-canvas"
          ref={canvas}
          aria-hidden="true"
          onPointerMove={hover}
          onClick={(event) => {
            const index = scene.current?.pick(event.clientX, event.clientY) ?? -1;
            if (index >= 0) onOpen(titles[index]);
          }}
        />
        <p className="tunnel-count"><span ref={counter}>01</span> / {titles.length}<small>Nine and above. One step below perfect.</small></p>
      </div>
    </section>
  );
}

export default memo(Tunnel);
