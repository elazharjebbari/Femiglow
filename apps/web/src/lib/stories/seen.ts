'use client';

/**
 * Persistance locale « story vue » (anneau gris vs accent). Best-effort :
 * chaque accès est protégé (localStorage indispo en privé / SSR / preview).
 */
const KEY = 'fg_stories_seen';

export function getSeenStories(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markStorySeen(id: string): void {
  try {
    const set = getSeenStories();
    set.add(id);
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* no-op */
  }
}
