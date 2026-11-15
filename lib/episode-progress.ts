export type EpisodePosition = { season: number; episode: number };
export type EpisodeGuide = { seasons: { season: number; episodes: number[] }[]; totalEpisodes: number; source: 'tvmaze' | 'tmdb'; fetchedAt: number };

/** Regular numbered episodes only; season zero and unnumbered specials are excluded. */
export function buildEpisodeGuide(rows: { season?: number; number?: number | null }[], source: EpisodeGuide['source']): EpisodeGuide {
  const seasons = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!Number.isSafeInteger(row.season) || row.season! <= 0 || !Number.isSafeInteger(row.number) || row.number! <= 0) continue;
    const episodes = seasons.get(row.season!) ?? new Set<number>();
    episodes.add(row.number!);
    seasons.set(row.season!, episodes);
  }
  const list = [...seasons].sort(([a], [b]) => a - b).map(([season, episodes]) => ({ season, episodes: [...episodes].sort((a, b) => a - b) }));
  if (!list.length) throw new Error('No regular episodes were found for this show. Use total episodes watched instead.');
  return { seasons: list, totalEpisodes: list.reduce((sum, item) => sum + item.episodes.length, 0), source, fetchedAt: Date.now() };
}

export function countThroughEpisode(guide: EpisodeGuide, position: EpisodePosition): number {
  if (!Number.isSafeInteger(position.season) || position.season <= 0 || !Number.isSafeInteger(position.episode) || position.episode <= 0) throw new Error('Enter a valid season and last-watched episode.');
  const current = guide.seasons.find((item) => item.season === position.season);
  if (!current || !current.episodes.includes(position.episode)) throw new Error('That season or episode is not in this show’s episode list.');
  for (let season = 1; season < position.season; season++) {
    if (!guide.seasons.some((item) => item.season === season)) throw new Error('The earlier-season episode list is incomplete. Use total episodes watched instead.');
  }
  return guide.seasons.reduce((sum, item) => sum + (item.season < position.season ? item.episodes.length : item.season === position.season ? item.episodes.filter((episode) => episode <= position.episode).length : 0), 0);
}
