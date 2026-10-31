// TMDB helpers. The pure functions are exported so they can be tested without a key.

const API = 'https://api.themoviedb.org/3';
export const IMAGES = 'https://image.tmdb.org/t/p';

const ANIMATION_GENRE = 16;
const LANGUAGES = {
  Anime: ['ja', 'zh', 'cn', 'ko'],
  'K-drama': ['ko'],
  'C-drama': ['zh', 'cn'],
  'J-drama': ['ja'],
  'Hindi series': ['hi'],
};
const EPISODE_MINUTES = { Anime: 24, 'Web series': 45, 'K-drama': 60, 'C-drama': 45, 'J-drama': 45, 'Hindi series': 40 };

/** Picks the search result that fits the category, so a K-drama doesn't match an American remake. */
export function pickMatch(results, type) {
  const languages = LANGUAGES[type];
  const fits = (r) =>
    (!languages || languages.includes(r.original_language)) &&
    (type !== 'Anime' || (r.genre_ids ?? []).includes(ANIMATION_GENRE));
  return results.find(fits) ?? null;
}

/** Suggests a category for a search result. It can still be changed before saving. */
export function guessType(result) {
  const language = result.original_language;
  if ((result.genre_ids ?? []).includes(ANIMATION_GENRE) && LANGUAGES.Anime.includes(language)) return 'Anime';
  if (language === 'ko') return 'K-drama';
  if (language === 'ja') return 'J-drama';
  if (language === 'zh' || language === 'cn') return 'C-drama';
  if (language === 'hi') return 'Hindi series';
  return 'Web series';
}

/** TMDB often leaves `episode_run_time` empty, so this falls back to a typical length. */
export function runtimeHours(detail, kind, type, episodesWatched) {
  if (kind === 'movie') return Math.max(1, Math.round((detail.runtime ?? 120) / 60));
  const episodes = episodesWatched ?? detail.number_of_episodes ?? 1;
  const listed = (detail.episode_run_time ?? []).filter(Boolean);
  const minutes = listed.length
    ? listed.reduce((a, b) => a + b, 0) / listed.length
    : (detail.last_episode_to_air?.runtime ?? EPISODE_MINUTES[type]);
  return Math.max(1, Math.round((episodes * minutes) / 60));
}

export function releaseYear(detail) {
  const date = detail.first_air_date || detail.release_date;
  return date ? Number(date.slice(0, 4)) : undefined;
}

/** Prefers the images people rated most, and caps them so one long-running show can't take minutes. */
export function chooseImages(images, limit = 8) {
  const byVotes = (list) => [...(list ?? [])].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const stills = byVotes(images.backdrops).slice(0, limit);
  const chosen = stills.length ? stills : byVotes(images.posters).slice(0, 1);
  return chosen.map((image) => image.file_path);
}

export function client(key) {
  // v4 read tokens are long JWTs sent as a header; v3 keys go in the query string.
  const isToken = key.includes('.');
  return async function get(path, params = {}) {
    const url = new URL(API + path);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    if (!isToken) url.searchParams.set('api_key', key);
    const res = await fetch(url, { headers: isToken ? { Authorization: `Bearer ${key}` } : {} });
    if (!res.ok) throw new Error(`TMDB answered ${res.status} for ${path}`);
    return res.json();
  };
}
