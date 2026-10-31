'use client';

import { memo } from 'react';
import { useNowShowing } from '@/lib/now-showing';
import type { Title } from '@/lib/types';

/** The fixed ticket stub. It always shows what's on screen, and its torn end opens the menu. */
function Ticket({ onOpen, onMenu }: { onOpen: (title: Title) => void; onMenu: () => void }) {
  const title = useNowShowing();
  return (
    <div className="ticket" role="group" aria-label="Now showing">
      <button className="ticket-main" disabled={!title} onClick={() => title && onOpen(title)} aria-label={title ? `Open ${title.name}` : 'Nothing on screen'}>
        {title && (
          <span className="ticket-swap" key={title.id}>
            <span className="ticket-top">
              {title.poster && <img src={title.poster.replace('/w342/', '/w92/')} alt="" />}
              <strong>{title.name}</strong>
            </span>
            <span className="ticket-meta">
              <span>{title.type}</span>
              <span>{title.year ?? '—'}</span>
              <span>{title.rating === null ? 'Unrated' : `${title.rating.toFixed(1)} / 10`}</span>
            </span>
          </span>
        )}
      </button>
      <button className="ticket-stub" onClick={onMenu} aria-label="Open menu"><i /><i /><i /></button>
    </div>
  );
}

export default memo(Ticket);
