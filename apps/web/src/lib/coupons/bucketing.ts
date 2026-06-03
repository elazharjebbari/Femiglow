/**
 * Bucketing holdout — DÉTERMINISTE (D-4).
 *
 * Décision retenue : `bucket = hash(visitorKey + ':' + couponId) % 100`,
 * comparé à `holdoutPct`. Le hash est sha256 tronqué à 4 octets (uniforme,
 * stable, sans dépendance externe). La propriété CRITIQUE n'est pas
 * l'algorithme précis mais le CONTRAT :
 *  - même (visitorKey, couponId) → toujours le même bucket ;
 *  - distribution ~uniforme sur 0..99 ;
 *  - `holdoutPct=0` → toujours `treatment` ;
 *  - `holdoutPct=100` → toujours `holdout` (si visitorKey présent) ;
 *  - `visitorKey` absent/vide → toujours `treatment` (jamais de holdout
 *    sans clé stable, sinon le bucket varierait entre affichage et checkout
 *    → mismatch prix).
 *
 * cf. docs/coupons-qa-2026-06-02/19-holdout-determinism/.
 */
import { createHash } from 'node:crypto';
import type { CouponBucket } from './types';

/** Entier 0..99 déterministe dérivé de la clé. */
export function bucketValue(visitorKey: string, couponId: string): number {
  const digest = createHash('sha256')
    .update(`${visitorKey}:${couponId}`)
    .digest();
  // 4 premiers octets → entier non signé 32 bits.
  const n = digest.readUInt32BE(0);
  return n % 100;
}

/** Borne `holdoutPct` dans [0, 100] (robustesse face à une saisie hors borne). */
export function clampHoldoutPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/**
 * Détermine le bucket d'un visiteur pour un coupon donné.
 * `visitorKey` falsy → `treatment` (cf. contrat ci-dessus).
 */
export function pickBucket(
  visitorKey: string | null | undefined,
  couponId: string,
  holdoutPct: number,
): CouponBucket {
  const pct = clampHoldoutPct(holdoutPct);
  if (pct <= 0) return 'treatment';
  if (!visitorKey) return 'treatment';
  if (pct >= 100) return 'holdout';
  return bucketValue(visitorKey, couponId) < pct ? 'holdout' : 'treatment';
}
