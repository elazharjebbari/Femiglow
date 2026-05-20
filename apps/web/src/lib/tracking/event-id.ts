/**
 * `deriveEventId` — génère un event_id déterministe basé sur un tuple
 * (eventName, sessionId, pageId, bucket 5min). Permet à Meta de dédupliquer
 * le même event tiré par le Pixel client et la CAPI server-side, à condition
 * que les deux côtés utilisent la même formule.
 *
 * Format de sortie : 32 caractères hex (128 bits d'entropie), tronqués
 * depuis un SHA-256. Compatible Meta event_id (max 40 chars accepté).
 *
 * Bucket 5min :
 *  - Une visite répétée 2x en 4 min → même event_id → dédup côté Meta.
 *  - Une visite répétée 2x à 10 min d'intervalle → 2 event_id distincts → 2 comptés.
 *  - Compromis entre dédup excessive (heure) et dédup nulle (seconde).
 *
 * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §2.3
 */
import { createHash } from 'node:crypto';

export interface DeriveEventIdInput {
  /** Nom de l'event canonique (ex: 'view_item', 'purchase'). */
  eventName: string;
  /** Identifiant de session client (cookie `fg_session_id` ou anonymousId). */
  sessionId: string;
  /** Slug stable de la page (ex: 'kit', 'maison', 'rituel'). */
  pageId: string;
  /** Timestamp ms — défault `Date.now()`. Utile pour les tests déterministes. */
  timestamp?: number;
}

const BUCKET_MS = 5 * 60 * 1000;

export function deriveEventId(input: DeriveEventIdInput): string {
  const ts = input.timestamp ?? Date.now();
  const bucket = Math.floor(ts / BUCKET_MS);
  const material = `${input.eventName}|${input.sessionId}|${input.pageId}|${bucket}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}
