import { useSyncExternalStore } from 'react';
import type { Title } from './types';

// What's on screen changes many times a second while scrolling. Keeping it here means
// only the ticket redraws, not the whole page.
let current: Title | null = null;
const listeners = new Set<() => void>();

export function setNowShowing(title: Title | null) {
  if (title === current) return;
  current = title;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useNowShowing = () => useSyncExternalStore(subscribe, () => current, () => null);
