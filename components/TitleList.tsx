'use client';

import { memo, useState } from 'react';
import { stripes } from '@/lib/colour';
import type { Title } from '@/lib/types';

const PREVIEW = 12;

function TitleList({ titles }: { titles: Title[] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? titles : titles.slice(0, PREVIEW);
  return (
    <>
      <div className="row head">
        <span />
        <span>Title</span>
        <span>Type</span>
        <span>Status</span>
        <span className="number">Hours</span>
        <span className="number">Rating</span>
      </div>
      {rows.map((title) => (
        <div className="row" key={title.id}>
          <i style={{ background: stripes(title.colours) }} />
          <em>{title.name}</em>
          <span>{title.type}</span>
          <span>{title.status ?? 'Finished'}</span>
          <span className="number">{title.hours}</span>
          <span className="number">{title.rating?.toFixed(1) ?? '–'}</span>
        </div>
      ))}
      {titles.length > PREVIEW && (
        <button className="more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${titles.length} titles`}
        </button>
      )}
    </>
  );
}

export default memo(TitleList);
