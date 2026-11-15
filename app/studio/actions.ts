'use server';

import { cookies } from 'next/headers';
import { buildTitleUpdate, toEntry, type Draft } from '@/lib/title-mutations';
import { createSession, passwordMatches, sessionIsValid } from '@/scripts/session.mjs';
import { readStore, writeStore } from '@/lib/store';
import { estimateHours } from '@/lib/data';
import { placeholderColours } from '@/lib/placeholder';
import { searchShows, showDetails } from '@/lib/tvmaze';
import { entryKey, type Category } from '@/lib/types';

const COOKIE = 'spectrum_session';
const MAX_NAME = 120;
const FAILED_LOGIN_DELAY_MS = 800;

export type { Draft } from '@/lib/title-mutations';
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
    if (entry.tmdbKind !== 'movie' && !entry.status && generated[key]?.totalEpisodes) {
      entry.totalEpisodes = generated[key].totalEpisodes;
      entry.episodes = generated[key].totalEpisodes;
      generated[key].hours = entry.hours ?? Math.max(1, Math.round(generated[key].totalEpisodes * (generated[key].runtimeMinutes ?? 24) / 60));
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
    const update = buildTitleUpdate(store, key, draft);
    await writeStore(update.store);
    return { ok: true, key: update.key, message: `${draft.title.trim()} saved.` };
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
