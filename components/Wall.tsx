'use client';

import { useEffect, useRef } from 'react';
import type { Title } from '@/lib/types';
import { WallEngine } from './wall-engine';

type Props = {
  all: Title[];
  visible: Title[];
  group?: (title: Title) => string;
  onFocus: (title: Title | null) => void;
  onPick: (title: Title) => void;
};

export default function Wall({ all, visible, group, onFocus, onPick }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ambient = useRef<HTMLCanvasElement>(null);
  const engine = useRef<WallEngine | null>(null);

  useEffect(() => {
    const wall = new WallEngine(stage.current!, canvas.current!, ambient.current!, all, { onFocus, onPick });
    engine.current = wall;
    return () => {
      wall.destroy();
      engine.current = null;
    };
  }, [all, onFocus, onPick]);

  useEffect(() => {
    engine.current?.show(visible, group);
  }, [all, visible, group]);

  return (
    <div
      className="stage"
      ref={stage}
      tabIndex={0}
      role="group"
      aria-label="Every title as a stripe of its colours, with taller stripes rated higher. Use the left and right arrow keys to move between titles, and Enter to select one."
    >
      <canvas className="ambient" ref={ambient} width={72} height={30} aria-hidden="true" />
      <canvas className="wall" ref={canvas} aria-hidden="true" />
    </div>
  );
}
