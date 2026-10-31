'use client';

import { useMemo, useState } from 'react';
import type { Title } from '@/lib/types';
import PosterReel from './PosterReel';

const PICKS = ['Violet Evergarden', 'Reply 1988', 'Death Note', 'Our Beloved Summer', 'Bleach', 'Hidden Love', 'One Piece', 'Vincenzo', 'A Silent Voice', 'First Love', 'Naruto', 'The First Frost'];

export default function CinemaHero({ titles, onOpen, onShuffle, paused, onPause }: { titles: Title[]; onOpen: (title: Title) => void; onShuffle: () => void; paused: boolean; onPause: () => void }) {
  const scenes = useMemo(() => {
    const picks = PICKS.flatMap(name => titles.find(t => t.name === name && (t.poster || t.backdrop)) ?? []);
    return picks.length > 3 ? picks : titles.filter(t => t.poster || t.backdrop).slice(0, 12);
  }, [titles]);
  const [active, setActive] = useState<Title | null>(null);
  const scene = active ?? scenes[0];
  return <header className="cinema-hero kinetic-hero" id="top">
    <div className="orbit-backdrop" aria-hidden="true">{scenes[0]?.backdrop && <img src={scenes[0].backdrop} alt="" />}<div className="scene-shutters"><i /><i /><i /><i /></div></div>
    <PosterReel titles={scenes} paused={paused} onOpen={onOpen} onActive={setActive} />
    <div className="cinema-content wrap">
      <div className="hero-prologue"><p>A personal archive of<br />fictional worlds & real feelings.</p><span>{titles.length} titles.<br />One incurable habit.</span></div>
      <h1 className="cinema-title"><span>ONE MORE</span><span>EPISODE.</span></h1>
      <div className="hero-bottom"><div className="hero-actions"><button className="primary" onClick={onShuffle}>Find my next obsession <span aria-hidden="true">↗</span></button><a className="text-link" href="#library">Enter the collection <span aria-hidden="true">↓</span></a></div></div>
    </div>
    <div className="reel-bottom wrap">{scene && <button className="reel-now" onClick={() => onOpen(scene)}><span>In the reel</span><strong>{scene.name} ↗</strong></button>}<span className="reel-note">A whole lot of stories.<br />Go on, get lost in one.</span><button className="motion-toggle" onClick={onPause} aria-pressed={paused}>{paused ? 'Play motion' : 'Pause motion'} <span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span></button></div>
  </header>;
}
