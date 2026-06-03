/**
 * Éligibilité & fenêtre de validité — fonctions PURES.
 *
 * Règles :
 *  - `eligibility = {}` (aucune clé) → tout le trafic est éligible.
 *  - Les clés présentes sont combinées en ET logique.
 *  - Une clé exigée mais absente du contexte → NON éligible (on ne devine pas).
 *  - Fenêtre : `startsAt <= now <= endsAt`, bornes incluses ; `null` = ouvert.
 *
 * cf. docs/coupons-qa-2026-06-02/03-engine-resolveCoupon/.
 */
import type { CouponDef, CouponContext } from './types';

export function isWithinWindow(coupon: CouponDef, now: Date): boolean {
  const t = now.getTime();
  if (coupon.startsAt && t < coupon.startsAt.getTime()) return false;
  if (coupon.endsAt && t > coupon.endsAt.getTime()) return false;
  return true;
}

export function isEligible(coupon: CouponDef, ctx: CouponContext): boolean {
  const e = coupon.eligibility ?? {};

  if (e.trafficSources && e.trafficSources.length > 0) {
    const src = ctx.trafficSource ?? null;
    if (!src || !e.trafficSources.includes(src)) return false;
  }

  if (e.visitorType) {
    if (ctx.visitorType !== e.visitorType) return false;
  }

  if (e.devices && e.devices.length > 0) {
    if (!ctx.device || !e.devices.includes(ctx.device)) return false;
  }

  return true;
}

/**
 * Statut actif + fenêtre + éligibilité (SANS contrainte de cible). Base
 * commune aux sélecteurs typés.
 */
export function isActiveEligible(coupon: CouponDef, ctx: CouponContext, now: Date): boolean {
  if (coupon.status !== 'active') return false;
  if (!isWithinWindow(coupon, now)) return false;
  if (!isEligible(coupon, ctx)) return false;
  return true;
}

/**
 * Candidat applicable pour le PRIX (Phase 1) : actif/éligible + cible
 * `product_price`.
 */
export function isCandidate(coupon: CouponDef, ctx: CouponContext, now: Date): boolean {
  return isActiveEligible(coupon, ctx, now) && coupon.target === 'product_price';
}
