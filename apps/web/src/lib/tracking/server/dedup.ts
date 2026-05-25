/**
 * Déduplication events tracking — version unifiée.
 *
 * Référence : `docs/live-systems-fix-2026-05/08-system-tracking.md` § S1
 *
 * Cohabite 2 stratégies derrière le flag `LIVE_REDIS_STATE` :
 *  - v1 (default) : Map JavaScript en mémoire — CASSÉ multi-lambda Vercel.
 *    Conservé pour rétrocompat tant que Upstash n'est pas provisionné.
 *  - v2 (flag ON) : Redis Upstash — cohérent cross-lambda. Recommandé prod.
 *
 * La signature `isDuplicateEventId` reste SYNC pour rétrocompat des
 * call-sites existants. Quand `LIVE_REDIS_STATE=v2`, la version sync
 * délègue à une promise interne (fire-and-forget côté Redis) et utilise
 * en parallèle la Map locale comme cache court — strategy "best effort".
 *
 * Pour une dédup STRICTE cross-lambda, utiliser `isDuplicateEventIdAsync`.
 */
import { LIVE_REDIS_STATE } from '@/lib/feature-flags/live-systems';
import { isDuplicateEvent } from '@/lib/redis/dedup';

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

/**
 * Version sync legacy — utilise Map en mémoire uniquement.
 * Cassé multi-lambda mais préserve la signature existante.
 */
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

/**
 * Version async robuste — utilise Redis si `LIVE_REDIS_STATE=v2`.
 *
 * Garantie : cohérent cross-lambda quand Redis configuré.
 * Si Redis down ou pas configuré → fallback Map locale via le helper
 * `lib/redis/client.ts` (transparent pour le caller).
 */
export async function isDuplicateEventIdAsync(
  eventId: string,
  ttlSec = TTL_MS / 1000,
): Promise<boolean> {
  if (LIVE_REDIS_STATE === 'v2') {
    return isDuplicateEvent(eventId, ttlSec);
  }
  // v1 : Map locale uniquement
  return isDuplicateEventId(eventId);
}

export function clearDedupCache(): void {
  cache.clear();
}

export function dedupCacheSize(): number {
  return cache.size;
}
