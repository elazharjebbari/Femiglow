/**
 * Helper de déduplication via Redis (avec fallback memory).
 *
 * Référence : `docs/live-systems-fix-2026-05/08-system-tracking.md` § S1
 *
 * Stratégie : SET NX (set if not exists) avec TTL.
 *  - Première fois → SET réussit, return false (pas duplicate)
 *  - Deuxième fois en TTL → SET fail, return true (duplicate détecté)
 *  - Après expiration TTL → SET réussit, retour normal (cycle 60s)
 *
 * Pourquoi pas in-memory Map ?
 * ─────────────────────────────
 * Vercel scale horizontalement les lambdas → chaque instance a sa propre
 * Map → la dédup ne marche pas cross-lambda. Redis externalisé garantit
 * la cohérence multi-process.
 */
import 'server-only';
import { redis } from './client';

/**
 * TTL par défaut pour les clés de déduplication.
 * 60s = couvre les retries client immédiats + reload navigateur.
 * À ajuster si les patterns prod diffèrent.
 */
const DEFAULT_DEDUP_TTL_SECONDS = 60;

/**
 * Marque un eventId comme vu et retourne true si déjà vu (duplicate).
 *
 * @param eventId Identifiant unique d'event (ex: 32 hex chars)
 * @param ttlSec TTL en secondes (default 60)
 * @returns true si l'event est un duplicate (déjà vu en TTL window)
 */
export async function isDuplicateEvent(
  eventId: string,
  ttlSec = DEFAULT_DEDUP_TTL_SECONDS,
): Promise<boolean> {
  if (!eventId || eventId.length === 0) return false;
  const key = `dedup:event:${eventId}`;
  // SET NX : retourne 'OK' si la clé n'existait pas, null sinon
  const result = await redis.set(key, '1', { nx: true, ex: ttlSec });
  // result === 'OK' → première fois → PAS duplicate
  // result === null → existait déjà → DUPLICATE
  return result !== 'OK';
}

/**
 * Reset cache dédup pour un eventId — utile en debug ou rejeu manuel.
 */
export async function resetDedupEvent(eventId: string): Promise<void> {
  await redis.del(`dedup:event:${eventId}`);
}
