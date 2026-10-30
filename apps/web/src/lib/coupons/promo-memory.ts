/**
 * Durée de mémorisation d'un code promo marketing (ex. GLOW99) appliqué depuis
 * un lien de campagne.
 *
 * Une cliente arrivée par `/kit?code=GLOW99` garde sa remise si elle revient
 * sans le lien (favori, historique) — mais seulement pendant 48 h après son
 * DERNIER passage par un lien portant le code. Au-delà, la page repasse au
 * prix normal : la promo ne doit pas rester active indéfiniment sur un
 * navigateur. Chaque nouveau clic sur une publicité relance la fenêtre.
 *
 * Ne concerne que les codes `promo` : un crédit de fidélité (`credit`) reste
 * mémorisé tant qu'il est valide côté serveur.
 */
import type { CouponKind } from '@/lib/checkout/state/wizard-store';

export const PROMO_MEMORY_MS = 48 * 60 * 60 * 1000;

export type RememberedPromoDecision =
  /** Rien à faire (pas de code, code non promo, ou fenêtre en cours). */
  | 'keep'
  /** Code promo d'un state antérieur au correctif : on ouvre la fenêtre maintenant. */
  | 'start-window'
  /** Fenêtre de 48 h dépassée : on retire le code. */
  | 'expire';

/**
 * Décide du sort d'un code mémorisé quand la page est ouverte SANS code dans
 * l'URL. (Avec un code dans l'URL, le code de l'URL gagne et la fenêtre repart.)
 */
export function decideRememberedPromo(input: {
  couponCode: string | null;
  couponKind: CouponKind | null;
  couponUrlSeenAt: number | null;
  now: number;
}): RememberedPromoDecision {
  const { couponCode, couponKind, couponUrlSeenAt, now } = input;
  if (!couponCode || couponKind !== 'promo') return 'keep';
  // State persisté avant l'introduction de l'horodatage : on ne retire pas
  // brutalement la remise d'une cliente venue récemment — la fenêtre de 48 h
  // démarre à cette visite.
  if (couponUrlSeenAt === null || !Number.isFinite(couponUrlSeenAt)) return 'start-window';
  return now - couponUrlSeenAt > PROMO_MEMORY_MS ? 'expire' : 'keep';
}
