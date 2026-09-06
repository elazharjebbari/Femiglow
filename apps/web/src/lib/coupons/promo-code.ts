/**
 * Codes promo MARKETING (`coupons.mode = 'code'`) — ex. « GLOW99 » diffusé
 * dans une campagne Meta : 199 → 99 MAD.
 *
 * Distinct des crédits de fidélité (`coupon_grants`, codes « FG-… ») : un code
 * promo est UNIQUE et partagé par toutes les clientes, sans activation
 * différée. Il se cumule avec le geste d'accueil (welcome_auto) : le moteur
 * de prix applique d'abord le geste d'accueil (289 → 199), puis le code
 * promo est soustrait comme un crédit (199 → 99). Côté client, il emprunte
 * exactement le circuit `creditCents` du wizard-store → les totaux affichés
 * et facturés restent alignés (anti PriceMismatchError).
 *
 * Règles de validité (toutes vérifiées ici, serveur autoritaire) :
 *  - coupon trouvé par code (insensible à la casse) et `mode='code'` ;
 *  - `status='active'` ;
 *  - fenêtre `startsAt` ≤ now ≤ `endsAt` (bornes optionnelles) ;
 *  - `target='product_price'` et `valueKind='fixed_amount'` (le % n'a pas de
 *    base connue à la validation → non supporté pour l'instant) ;
 *  - `usageScope='global_cap'` → `usageCount < usageCap`.
 *
 * `resolveRedeemableCode` unifie crédit fidélité + code promo pour
 * /api/coupons/redeem et order-repo : un seul point de vérité.
 */
import type { CouponDef } from '@/lib/coupons/types';

export type PromoCodeInvalidReason =
  | 'not_found'
  | 'inactive'
  | 'not_yet_active'
  | 'expired'
  | 'cap_reached'
  | 'unsupported';

export type PromoCodeValidity =
  | { valid: true; coupon: CouponDef; valueCents: number }
  | { valid: false; reason: PromoCodeInvalidReason };

/** Valide un code promo marketing SANS le consommer. */
export async function validatePromoCode(
  code: string,
  now: Date = new Date(),
): Promise<PromoCodeValidity> {
  const { findCouponByCode } = await import('@/lib/db/queries/coupon-repo');
  const coupon = await findCouponByCode(code);
  if (!coupon || coupon.mode !== 'code') return { valid: false, reason: 'not_found' };
  return checkPromoCoupon(coupon, now);
}

/** Règles pures (testables sans repo) appliquées à une définition de coupon. */
export function checkPromoCoupon(coupon: CouponDef, now: Date = new Date()): PromoCodeValidity {
  if (coupon.mode !== 'code') return { valid: false, reason: 'not_found' };
  if (coupon.status !== 'active') return { valid: false, reason: 'inactive' };
  if (coupon.startsAt && now.getTime() < coupon.startsAt.getTime()) {
    return { valid: false, reason: 'not_yet_active' };
  }
  if (coupon.endsAt && now.getTime() > coupon.endsAt.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  if (coupon.target !== 'product_price' || coupon.valueKind !== 'fixed_amount') {
    return { valid: false, reason: 'unsupported' };
  }
  if (
    coupon.usageScope === 'global_cap' &&
    coupon.usageCap !== null &&
    coupon.usageCap !== undefined &&
    coupon.usageCount >= coupon.usageCap
  ) {
    return { valid: false, reason: 'cap_reached' };
  }
  const valueCents = Math.max(0, Math.round(coupon.valueAmount));
  if (valueCents <= 0) return { valid: false, reason: 'unsupported' };
  return { valid: true, coupon, valueCents };
}

export type RedeemableKind = 'credit' | 'promo';

export type RedeemableCode =
  | {
      valid: true;
      kind: 'credit';
      code: string;
      valueCents: number;
      /** Code du grant (normalisé) à consommer après la commande. */
      grantCode: string;
    }
  | {
      valid: true;
      kind: 'promo';
      code: string;
      valueCents: number;
      coupon: CouponDef;
    }
  | { valid: false; reason: string };

/**
 * Résout un code saisi par la cliente : crédit de fidélité (FG-…) d'abord,
 * puis code promo marketing. Le motif d'échec renvoyé est celui du type de
 * code effectivement reconnu ; `not_found` seulement si aucun des deux ne le
 * connaît.
 */
export async function resolveRedeemableCode(
  code: string,
  now: Date = new Date(),
): Promise<RedeemableCode> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, reason: 'not_found' };

  const { validateGrant } = await import('@/lib/db/queries/coupon-grant-repo');
  const grant = await validateGrant(normalized, now);
  if (grant.valid) {
    return {
      valid: true,
      kind: 'credit',
      code: normalized,
      valueCents: grant.valueCents,
      grantCode: grant.grant.code,
    };
  }
  if (grant.reason !== 'not_found') return { valid: false, reason: grant.reason };

  const promo = await validatePromoCode(normalized, now);
  if (promo.valid) {
    return {
      valid: true,
      kind: 'promo',
      code: normalized,
      valueCents: promo.valueCents,
      coupon: promo.coupon,
    };
  }
  return { valid: false, reason: promo.reason };
}
