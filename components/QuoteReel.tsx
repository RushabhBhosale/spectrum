'use client';

import { useState, type CSSProperties } from 'react';
import type { Title } from '@/lib/types';

function QuoteContent({ title }: { title: Title }) {
  const image = title.poster ?? title.backdrop ?? title.stills[0];
  return (
    <>
      <span className="quote-card-text">“{title.quote}”</span>
      <span className="quote-card-source">
        {image && <img className="quote-card-image" src={image} alt="" loading="lazy" />}
        <span className="quote-card-title">{title.name} <span aria-hidden="true">↗</span></span>
      </span>
    </>
  );
}

export default function QuoteReel({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const [paused, setPaused] = useState(false);
  // Each half fills a wide screen, even when the collection starts with only two quotes.
  const copies = titles.length > 1 ? Math.ceil(8 / titles.length) : 1;
  const groups = titles.length > 1 ? 2 : 1;
  const duration = Math.max(30, copies * titles.length * 7);

  return (
    <div className="quote-marquee" data-paused={paused} data-moving={titles.length > 1}>
      <div className="quote-marquee-top">
        <p>{titles.length} {titles.length === 1 ? 'line' : 'lines'} worth remembering</p>
        {titles.length > 1 && <button onClick={() => setPaused((value) => !value)}>{paused ? 'Play quotes' : 'Pause quotes'}</button>}
      </div>
      <div className="quote-marquee-window">
        <div className="quote-marquee-track" style={{ '--quote-duration': `${duration}s` } as CSSProperties}>
          {Array.from({ length: groups }, (_, group) => (
            <div className="quote-marquee-group" key={group} aria-hidden={group > 0 || undefined}>
              {Array.from({ length: copies }, (_, copy) => titles.map((title) => (
                group === 0 && copy === 0 ? (
                  <button className="quote-card" key={`${copy}-${title.id}`} onClick={() => onOpen(title)}><QuoteContent title={title} /></button>
                ) : (
                  <div className="quote-card quote-card-repeat" key={`${copy}-${title.id}`} aria-hidden="true" onClick={() => onOpen(title)}><QuoteContent title={title} /></div>
                )
              )))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
