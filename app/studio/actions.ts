'use server';

import { cookies } from 'next/headers';
import { createSession, passwordMatches, sessionIsValid } from '@/scripts/session.mjs';
import { readStore, writeStore } from '@/lib/store';
import { estimateHours } from '@/lib/data';
import { placeholderColours } from '@/lib/placeholder';
import { searchShows, showDetails } from '@/lib/tvmaze';
import { CATEGORIES, entryKey, STATUSES, type Category, type Entry } from '@/lib/types';

const COOKIE = 'spectrum_session';
const MAX_QUOTE = 400;
const MAX_NAME = 120;
const FAILED_LOGIN_DELAY_MS = 800;

export type Draft = {
  title: string;
  type: Category;
  rating: string;
  status: string;
  episodes: string;
  quote: string;
  tvmazeId?: number;
  posterUrl?: string;
  tmdbKind?: 'tv' | 'movie';
};
export type Result = { ok: true; message: string; key?: string } | { ok: false; message: string };
export type Match = {
  id: number;
  kind: 'tv' | 'movie';
  name: string;
  year?: number;
  poster?: string;
  type: Category;
};

export async function isSignedIn() {
  const jar = await cookies();
  return sessionIsValid(jar.get(COOKIE)?.value, process.env.ADMIN_PASSWORD);
}

async function requireSession() {
  if (!(await isSignedIn())) throw new Error('Sign in again to continue');
}

export async function signIn(_: unknown, form: FormData): Promise<Result> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return { ok: false, message: 'Set ADMIN_PASSWORD first. See the README.' };
  if (!passwordMatches(String(form.get('password') ?? ''), password)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { ok: false, message: "That password isn't right." };
  }
  const jar = await cookies();
  jar.set(COOKIE, createSession(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true, message: 'Signed in' };
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function searchTitles(query: string): Promise<{ ok: true; matches: Match[] } | { ok: false; message: string }> {
  try {
    await requireSession();
    const text = query.trim().slice(0, MAX_NAME);
    return { ok: true, matches: text ? await searchShows(text) : [] };
  } catch (error) {
    console.error('TVmaze search failed:', error);
    return { ok: false, message: 'Could not reach TVmaze. Check your connection or add the title manually.' };
  }
}

function toEntry(draft: Draft, previous?: Entry): Entry | string {
  const title = draft.title.trim().slice(0, MAX_NAME);
  if (!title) return 'Give it a title.';
  if (!CATEGORIES.includes(draft.type)) return 'Pick a category.';
  const rating = draft.rating.trim() === '' ? null : Number(draft.rating);
  if (rating !== null && !(rating >= 0 && rating <= 10)) return 'Ratings go from 0 to 10.';
  const episodes = draft.episodes.trim() === '' ? undefined : Number(draft.episodes);
  if (episodes !== undefined && !(Number.isInteger(episodes) && episodes > 0)) return 'Episodes should be a whole number.';
  if (draft.status && !(STATUSES as readonly string[]).includes(draft.status) && draft.status !== previous?.status) return 'Pick a status.';

  const entry: Entry = { ...previous, title, type: draft.type, rating };
  const setText = (field: 'status' | 'quote', value: string, limit: number) => {
    const text = value.trim().slice(0, limit);
    if (text) entry[field] = text;
    else delete entry[field];
  };
  setText('status', draft.status === 'Finished' ? '' : draft.status, MAX_NAME);
  setText('quote', draft.quote, MAX_QUOTE);
  if (episodes) entry.episodes = episodes;
  else delete entry.episodes;
  if (draft.tmdbKind) entry.tmdbKind = draft.tmdbKind;
  return entry;
}

export async function addTitle(draft: Draft): Promise<Result> {
  try {
    await requireSession();
    const entry = toEntry(draft);
    if (typeof entry === 'string') return { ok: false, message: entry };
    const store = await readStore();
    const key = entryKey(entry);
    if (store.generated[key] || store.titles.some((t) => entryKey(t) === key)) {
      return { ok: false, message: `${entry.title} is already in ${entry.type}.` };
    }
    const generated = { ...store.generated };
    if (draft.tvmazeId) generated[key] = await showDetails(draft.tvmazeId, entry);
    else if (draft.posterUrl?.trim()) {
      let poster: URL;
      try { poster = new URL(draft.posterUrl.trim()); } catch { return { ok: false, message: 'Enter a valid poster URL.' }; }
      if (poster.protocol !== 'https:' || poster.username || poster.password || poster.href.length > 2048) return { ok: false, message: 'Use an HTTPS poster URL without login details.' };
      generated[key] = { tmdbKind: entry.tmdbKind ?? 'tv', hours: estimateHours(entry), colours: placeholderColours(entry.title, entry.type), poster: poster.href };
    }
    await writeStore({ titles: [entry, ...store.titles], generated, version: store.version });
    return { ok: true, key, message: `${entry.title} added.` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function updateTitle(key: string, draft: Draft): Promise<Result> {
  try {
    await requireSession();
    const store = await readStore();
    const index = store.titles.findIndex((t) => entryKey(t) === key);
    if (index < 0) return { ok: false, message: "That title isn't in your list any more." };
    const previous = store.titles[index];
    const entry = toEntry(draft, previous);
    if (typeof entry === 'string') return { ok: false, message: entry };
    const nextKey = entryKey(entry);
    if (nextKey !== key && store.titles.some((t) => entryKey(t) === nextKey)) {
      return { ok: false, message: `${entry.title} is already in ${entry.type}.` };
    }

    const generated = { ...store.generated };
    const known = generated[key];
    delete generated[key];
    const episodesChanged = entry.episodes !== previous.episodes;
    if (known) {
      const runtime = known.runtimeMinutes ?? (previous.episodes ? known.hours * 60 / previous.episodes : undefined);
      const hours = episodesChanged && (entry.tmdbKind ?? known.tmdbKind) !== 'movie'
        ? (entry.episodes && runtime ? Math.max(1, Math.round(entry.episodes * runtime / 60)) : estimateHours(entry))
        : known.hours;
      generated[nextKey] = { ...known, tmdbKind: entry.tmdbKind ?? known.tmdbKind, hours };
    }

    const titles = [...store.titles];
    titles[index] = entry;
    await writeStore({ titles, generated, version: store.version });
    return { ok: true, key: nextKey, message: `${entry.title} saved.` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function removeTitle(key: string): Promise<Result> {
  try {
    await requireSession();
    const store = await readStore();
    const entry = store.titles.find((t) => entryKey(t) === key);
    if (!entry) return { ok: false, message: "That title isn't in your list any more." };
    const generated = { ...store.generated };
    delete generated[key];
    await writeStore({ titles: store.titles.filter((t) => t !== entry), generated, version: store.version });
    return { ok: true, message: `${entry.title} removed.` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
