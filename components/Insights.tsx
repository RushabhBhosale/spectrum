'use client';

import { memo, useMemo } from 'react';
import { glow, stripes } from '@/lib/colour';
import { genreShares, superlatives, yearBars } from '@/lib/stats';
import type { Title } from '@/lib/types';

const YEAR_LABEL_STEP = 5;

function Insights({ titles, onOpen }: { titles: Title[]; onOpen: (title: Title) => void }) {
  const awards = useMemo(() => superlatives(titles), [titles]);
  const genres = useMemo(() => genreShares(titles), [titles]);
  const years = useMemo(() => yearBars(titles), [titles]);
  const widestGenre = Math.max(1, ...genres.map((g) => g.count));
  const tallestYear = Math.max(1, ...years.map((y) => y.titles.length));

  return (
    <>
      <div className="awards">
        {awards.map((award) => (
          <button key={award.label} disabled={!award.title} onClick={() => award.title && onOpen(award.title)}>
            <i style={{ background: award.title ? glow(award.title.colours, '90deg') : 'none' }} />
            <span className="label">{award.label}</span>
            <strong>{award.value}</strong>
            <span className="award-note">{award.note}</span>
          </button>
        ))}
      </div>

      {genres.length > 0 && (
        <>
          <h3 className="sub">Genres</h3>
          <div className="genres">
            {genres.map((genre) => (
              <div className="genre" key={genre.genre}>
                <span>{genre.genre}</span>
                <i style={{ width: `${(genre.count / widestGenre) * 100}%`, background: stripes(genre.titles.map((t) => t.accent)) }} />
                <span className="number">{genre.count} · {genre.average.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {years.length > 0 && (
        <>
          <h3 className="sub">Release years</h3>
          <div className="years" role="img" aria-label={`Titles by release year, from ${years[0].year} to ${years[years.length - 1].year}`}>
            {years.map((bar) => (
              <div key={bar.year} title={`${bar.year}: ${bar.titles.length}`}>
                <i style={{ height: `${(bar.titles.length / tallestYear) * 100}%`, background: stripes(bar.titles.map((t) => t.accent), '0deg') }} />
                <span>{bar.year % YEAR_LABEL_STEP === 0 ? bar.year : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default memo(Insights);
