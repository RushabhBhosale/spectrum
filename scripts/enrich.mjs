// Looks a title up on TMDB and builds everything the site stores about it.
import sharp from 'sharp';
import { extractPalette } from './palette.mjs';
import { IMAGES, chooseImages, pickMatch, releaseYear, runtimeHours } from './tmdb.mjs';

const ANIMATION = 'Animation';

async function find(get, entry) {
  if (entry.tmdbId) return { id: entry.tmdbId, kind: entry.tmdbKind ?? 'tv' };
  const search = async (kind) => {
    const { results } = await get(`/search/${kind}`, { query: entry.title, include_adult: 'false' });
    const match = pickMatch(results, entry.type);
    return match && { id: match.id, kind };
  };
  if (entry.tmdbKind === 'movie') return search('movie');
  return (await search('tv')) ?? (entry.type === 'Anime' ? search('movie') : null);
}

async function pixelsOf(path) {
  const res = await fetch(`${IMAGES}/w300${path}`);
  if (!res.ok) throw new Error(`Image ${path} answered ${res.status}`);
  const image = Buffer.from(await res.arrayBuffer());
  return sharp(image).resize(64, 36, { fit: 'cover' }).removeAlpha().raw().toBuffer();
}

/** @returns the generated record for a title, or null if TMDB has nothing usable. */
export async function enrich(get, entry) {
  const match = await find(get, entry);
  if (!match) return null;
  const base = `/${match.kind}/${match.id}`;
  const [detail, images] = await Promise.all([get(base), get(`${base}/images`)]);
  const paths = chooseImages(images);
  if (!paths.length) return null;
  // One dead image shouldn't cost a title its colours.
  const read = await Promise.allSettled(paths.map(pixelsOf));
  const pixels = read.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (!pixels.length) return null;
  const { colours, accent } = extractPalette(Buffer.concat(pixels));
  return {
    tmdbId: match.id,
    tmdbKind: match.kind,
    tmdbName: detail.name ?? detail.title,
    year: releaseYear(detail),
    hours: runtimeHours(detail, match.kind, entry.type, entry.episodes),
    genres: (detail.genres ?? []).map((g) => g.name).filter((name) => name !== ANIMATION),
    poster: detail.poster_path ? `${IMAGES}/w342${detail.poster_path}` : undefined,
    backdrop: detail.backdrop_path ? `${IMAGES}/w1280${detail.backdrop_path}` : undefined,
    colours,
    accent,
  };
}
