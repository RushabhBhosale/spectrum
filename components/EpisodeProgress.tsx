'use client';

import { useEffect, useState } from 'react';
import { getTitleEpisodeGuide, type Draft } from '@/app/studio/actions';
import { countThroughEpisode, type EpisodeGuide } from '@/lib/episode-progress';

export default function EpisodeProgress({ titleKey, draft, disabled, onChange, onReadyChange }: {
  titleKey?: string;
  draft: Draft;
  disabled: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onReadyChange: (ready: boolean) => void;
}) {
  const mode = draft.progressMode ?? 'count';
  const [guide, setGuide] = useState<EpisodeGuide | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode !== 'season') return;
    let active = true;
    setGuide(null); setError(''); setLoading(true);
    void getTitleEpisodeGuide({ key: titleKey, tvmazeId: draft.tvmazeId, title: draft.title, type: draft.type }).then((result) => {
      if (!active) return;
      if (result.ok) setGuide(result.guide);
      else setError(result.message);
    }).catch(() => { if (active) setError('Could not load the episode list. Try again or use total episodes watched.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, titleKey, draft.tvmazeId, draft.title, draft.type, attempt]);
  let calculated: number | null = null;
  let invalid = '';
  if (guide && draft.season && draft.episode) {
    try { calculated = countThroughEpisode(guide, { season: Number(draft.season), episode: Number(draft.episode) }); }
    catch (err) { invalid = (err as Error).message; }
  }

  const ready = mode === 'count' || calculated !== null && !invalid && !error && !(draft.status === 'Finished' && calculated < guide!.totalEpisodes);
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);

  return <fieldset style={{ border: '1px solid var(--muted)', padding: 16, margin: 0 }} disabled={disabled}>
    <legend className="label">Episode progress</legend>
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
      <label style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}><input style={{ width: 16, height: 16, minHeight: 16, padding: 0, marginRight: 8, accentColor: 'var(--accent)' }} type="radio" name="episode-progress-mode" checked={mode === 'count'} onChange={() => onChange({ progressMode: 'count' })} /> Total episodes watched</label>
      <label style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}><input style={{ width: 16, height: 16, minHeight: 16, padding: 0, marginRight: 8, accentColor: 'var(--accent)' }} type="radio" name="episode-progress-mode" checked={mode === 'season'} onChange={() => onChange({ progressMode: 'season' })} /> Season &amp; episode</label>
    </div>
    {mode === 'count' ? <label className="field"><span className="label">Episodes watched</span><input id="edit-episodes" type="number" min="0" max={draft.totalEpisodes || undefined} step="1" value={draft.episodes} onChange={(event) => onChange({ episodes: event.target.value })} /></label> : <>
      <p className="editor-note">Enter the last episode you finished. All regular episodes in earlier seasons are included; specials are excluded.</p>
      <div className="field-row">
        <label className="field"><span className="label">Season</span><input type="number" min="1" step="1" placeholder="5" value={draft.season ?? ''} onChange={(event) => onChange({ season: event.target.value })} /></label>
        <label className="field"><span className="label">Episode finished</span><input type="number" min="1" step="1" placeholder="4" value={draft.episode ?? ''} onChange={(event) => onChange({ episode: event.target.value })} /></label>
      </div>
      <p role="status" className="editor-note">{loading ? 'Loading this show’s episode list…' : error || invalid || (calculated !== null ? `${calculated} / ${guide!.totalEpisodes} episodes watched` : 'Choose a season and episode to calculate your total.')}</p>
      {error ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry episode list</button> : null}
      {draft.status === 'Finished' && calculated !== null && calculated < guide!.totalEpisodes ? <p className="notice">Choose Watching, On hold or another unfinished status for partial progress.</p> : null}
    </>}
  </fieldset>;
}
