'use client';

import { memo, useMemo, useState } from 'react';
import { stripes } from '@/lib/colour';
import { isUnfinished, type Title } from '@/lib/types';
import Poster from './Poster';

const PAGE = 60;

function Library({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const [view, setView] = useState<'posters' | 'list'>('posters');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const found = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text ? titles.filter((t) => t.name.toLowerCase().includes(text)) : titles;
  }, [titles, query]);
  const shown = found.slice(0, limit);

  return (
    <>
      <div className="library-bar">
        <input
          id="library-search"
          type="search"
          aria-label="Search your titles"
          placeholder={`Search ${titles.length} titles`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE);
          }}
        />
        <div className="group" role="group" aria-label="Choose a view">
          <button aria-pressed={view === 'posters'} onClick={() => setView('posters')}>Posters</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {found.length === 0 && <p className="notice">Nothing matches that search.</p>}

      {view === 'posters' ? (
        <div className="posters">
          {shown.map((title) => (
            <button key={title.id} className={isUnfinished(title) ? 'unfinished' : ''} onClick={() => onOpen(title)}>
              <Poster title={title} />
              <span className="poster-score">{title.rating?.toFixed(1) ?? '–'}</span>
              <span className="poster-name">{title.name}</span>
              <span className="poster-meta">{title.status ?? title.type}</span>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="row head">
            <span />
            <span>Title</span>
            <span>Type</span>
            <span>Status</span>
            <span className="number">Hours</span>
            <span className="number">Rating</span>
          </div>
          {shown.map((title) => (
            <button className="row" key={title.id} onClick={() => onOpen(title)}>
              <i style={{ background: stripes(title.colours) }} />
              <em>{title.name}</em>
              <span>{title.type}</span>
              <span>{title.status ?? 'Finished'}</span>
              <span className="number">{title.hours}</span>
              <span className="number">{title.rating?.toFixed(1) ?? '–'}</span>
            </button>
          ))}
        </div>
      )}

      {found.length > limit && (
        <button className="more" onClick={() => setLimit(limit + PAGE * 2)}>
          Show more ({found.length - limit} left)
        </button>
      )}
    </>
  );
}

export default memo(Library);
