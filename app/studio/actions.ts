'use server';

import { cookies } from 'next/headers';
import { episodeGuideFor, resolveProgressDraft } from '@/lib/episode-guide';
import { CATEGORIES } from '@/lib/types';
import type { EpisodeGuide } from '@/lib/episode-progress';
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
    let entry = toEntry(draft.progressMode === 'season' ? { ...draft, progressMode: 'count', episodes: '' } : draft);
    if (typeof entry === 'string') return { ok: false, message: entry };
    const store = await readStore();
    const key = entryKey(entry);
    if (store.generated[key] || store.titles.some((t) => entryKey(t) === key)) {
      return { ok: false, message: `${entry.title} is already in ${entry.type}.` };
    }
    let generated = { ...store.generated };
    if (draft.tvmazeId) generated[key] = await showDetails(draft.tvmazeId, entry);
    else if (draft.posterUrl?.trim()) {
      let poster: URL;
      try { poster = new URL(draft.posterUrl.trim()); } catch { return { ok: false, message: 'Enter a valid poster URL.' }; }
      if (poster.protocol !== 'https:' || poster.username || poster.password || poster.href.length > 2048) return { ok: false, message: 'Use an HTTPS poster URL without login details.' };
      generated[key] = { tmdbKind: entry.tmdbKind ?? 'tv', hours: estimateHours(entry), colours: placeholderColours(entry.title, entry.type), poster: poster.href };
    }
    if (draft.progressMode === 'season') {
      const resolved = await resolveProgressDraft({ titles: [entry], generated, version: store.version }, key, draft);
      const next = toEntry(resolved.draft, entry);
      if (typeof next === 'string') return { ok: false, message: next };
      entry = next;
      generated = resolved.store.generated;
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
    const resolved = await resolveProgressDraft(store, key, draft);
    const update = buildTitleUpdate(resolved.store, key, resolved.draft);
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


export async function getTitleEpisodeGuide(input: { key?: string; tvmazeId?: number; title?: string; type?: Category }): Promise<{ ok: true; guide: EpisodeGuide } | { ok: false; message: string }> {
  try {
    await requireSession();
    if (input.key) {
      const store = await readStore();
      const entry = store.titles.find((item) => entryKey(item) === input.key);
      if (!entry) throw new Error('Title not found. Refresh your list.');
      return { ok: true, guide: await episodeGuideFor(entry, store.generated[input.key]) };
    }
    if (!input.title?.trim() || input.title.length > MAX_NAME || !input.type || !CATEGORIES.includes(input.type)) throw new Error('Choose a title first.');
    const entry = { title: input.title, type: input.type, rating: null, tmdbKind: 'tv' as const };
    const extra = input.tvmazeId && Number.isSafeInteger(input.tvmazeId) && input.tvmazeId > 0 ? { catalogSource: 'tvmaze' as const, catalogId: input.tvmazeId, tmdbKind: 'tv' as const, colours: [], hours: 0 } : undefined;
    return { ok: true, guide: await episodeGuideFor(entry, extra) };
  } catch (error) { return { ok: false, message: (error as Error).message }; }
}
