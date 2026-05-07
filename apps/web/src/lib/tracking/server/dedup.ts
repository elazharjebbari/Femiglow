const MAX_ENTRIES = 50_000;
const TTL_MS = 60_000;

interface Entry {
  expiresAt: number;
}

const cache = new Map<string, Entry>();

function evictExpired(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
    else break;
  }
}

export function isDuplicateEventId(eventId: string, now: number = Date.now()): boolean {
  const existing = cache.get(eventId);
  if (existing && existing.expiresAt > now) return true;
  if (existing) cache.delete(eventId);
  if (cache.size >= MAX_ENTRIES) {
    evictExpired(now);
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
  }
  cache.set(eventId, { expiresAt: now + TTL_MS });
  return false;
}

export function clearDedupCache(): void {
  cache.clear();
}

export function dedupCacheSize(): number {
  return cache.size;
}
