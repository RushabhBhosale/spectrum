import sharp from 'sharp';
import { extractPalette } from '@/scripts/palette.mjs';
import { estimateHours } from './data';
import { placeholderColours } from './placeholder';
import type { Category, Entry, Generated } from './types';

type Show = {
  id: number; name: string; type?: string; language?: string; genres?: string[];
  premiered?: string | null; averageRuntime?: number | null; runtime?: number | null;
  image?: { medium?: string; original?: string } | null;
};

function category(show: Show): Category {
  if (show.genres?.includes('Anime') || (show.type === 'Animation' && ['Japanese', 'Korean', 'Chinese'].includes(show.language ?? ''))) return 'Anime';
  if (show.language === 'Korean') return 'K-drama';
  if (show.language === 'Japanese') return 'J-drama';
  if (['Chinese', 'Mandarin'].includes(show.language ?? '')) return 'C-drama';
  if (show.language === 'Hindi') return 'Hindi series';
  return 'Web series';
}

async function get(path: string) {
  const response = await fetch(`https://api.tvmaze.com${path}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`TVmaze returned ${response.status}`);
  return response.json();
}

export async function searchShows(query: string) {
  const results: { show: Show }[] = await get(`/search/shows?q=${encodeURIComponent(query)}`);
  return results.slice(0, 12).map(({ show }) => ({
    id: show.id, kind: 'tv' as const, name: show.name,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : undefined,
    poster: show.image?.medium, type: category(show),
  }));
}

export async function showDetails(id: number, entry: Entry): Promise<Generated> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a valid title.');
  const show: Show = await get(`/shows/${id}`);
  const poster = show.image?.original ?? show.image?.medium;
  let colours = placeholderColours(entry.title, entry.type);
  let accent = colours[3];
  if (poster) {
    try {
      const response = await fetch(poster, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const pixels = await sharp(Buffer.from(await response.arrayBuffer())).resize(64, 36, { fit: 'cover' }).removeAlpha().raw().toBuffer();
        ({ colours, accent } = extractPalette(pixels));
      }
    } catch { /* Keep the deterministic palette if the image is unavailable. */ }
  }
  const runtimeMinutes = show.averageRuntime || show.runtime || undefined;
  const hours = entry.tmdbKind !== 'movie' && entry.episodes && runtimeMinutes ? Math.max(1, Math.round(entry.episodes * runtimeMinutes / 60)) : estimateHours(entry);
  return { tmdbKind: entry.tmdbKind ?? 'tv', catalogSource: 'tvmaze', catalogId: show.id, runtimeMinutes, year: show.premiered ? Number(show.premiered.slice(0, 4)) : undefined, hours, colours, accent, genres: show.genres ?? [], poster };
}
