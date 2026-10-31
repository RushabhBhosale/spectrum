'use client';

import { useEffect, useRef } from 'react';
import { glow } from '@/lib/colour';
import { isUnfinished, type Title } from '@/lib/types';
import Poster from './Poster';

export default function TitleSheet({ title, onClose }: { title: Title | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current!;
    if (title && !element.open) element.showModal();
    if (!title && element.open) element.close();
  }, [title]);

  return (
    <dialog
      className="sheet"
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-label={title?.name}
    >
      {title && (
        <div className="sheet-body">
          <div className="sheet-hero" style={{ background: glow(title.colours, '135deg') }}>
            {title.backdrop && <img src={title.backdrop} alt="" />}
            <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="sheet-main">
            <Poster title={title} />
            <div className="sheet-copy">
              <div className="label">{[title.type, title.year, title.status].filter(Boolean).join(' · ')}</div>
              <h2>{title.name}</h2>
              <div className="sheet-score">
                {title.rating === null ? <span className="unrated">Unrated</span> : <>{title.rating.toFixed(1)}<small>/10</small></>}
              </div>
            </div>
          </div>
          {title.quote && (
            <blockquote>
              {title.quote}
              {title.quoteBy && <cite>{title.quoteBy}</cite>}
            </blockquote>
          )}
          {title.review && <p className="sheet-review">{title.review}</p>}
          <dl className="sheet-facts">
            <div><dt className="label">{isUnfinished(title) ? 'Hours so far' : 'Hours'}</dt><dd>{title.hours.toLocaleString('en-US')}</dd></div>
            <div><dt className="label">Frames</dt><dd>{(title.hours * 86400).toLocaleString('en-US')}</dd></div>
            {title.genres.length > 0 && <div className="wide"><dt className="label">Genres</dt><dd>{title.genres.join(', ')}</dd></div>}
          </dl>
          <div className="sheet-palette" aria-hidden="true">
            {title.colours.map((colour, index) => <i key={`${colour}-${index}`} style={{ background: colour }} />)}
          </div>
        </div>
      )}
    </dialog>
  );
}
