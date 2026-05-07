/**
 * Calcul d'une remise affichable côté UI.
 *
 * Source de vérité unique pour décider :
 *  - si la promo est « active » (montant valide, strictement < prix),
 *  - du montant économisé en centimes,
 *  - du pourcentage de remise (arrondi à l'entier),
 *  - du framing à privilégier (% vs montant) selon la heuristique Kolenda
 *    Pricing #34 « show whichever digit is higher ».
 *
 * Pourquoi un module dédié ?
 *  - la même logique est consommée par <PriceDisplay>, l'admin, le tracking
 *    (ecommerce.value), JSON-LD (offers.price) et le panier ;
 *  - on évite les variantes locales qui finiraient par diverger.
 *
 * Conventions
 *  - Tous les montants sont en centimes (entiers, ×100 vs unité majeure),
 *    cohérents avec `formatPrice()` qui divise toujours par 100.
 *  - `null`/négatif/promo >= prix → `active: false` (silencieux, pas
 *    d'exception : l'UI publique ne doit jamais planter pour une saisie
 *    incohérente).
 */
import type { Currency } from '@/lib/products/currency';

export interface PromoComputation {
  /** Le rabais est-il valide et affichable ? */
  active: boolean;
  /** Prix effectivement payé par le client (promo si active, sinon prix). */
  effectivePriceCents: number;
  /** Prix barré original (= `priceCents` quel que soit l'état). */
  originalPriceCents: number;
  /** Centimes économisés. `0` quand `active === false`. */
  savingsCents: number;
  /** Pourcentage de remise arrondi à l'entier. `0` quand `active === false`. */
  savingsPct: number;
  /**
   * Framing recommandé pour la mention « Économisez … » :
   * - `'amount'` si la valeur en montant est supérieure ou égale à la valeur
   *   en pourcentage (Kolenda #34 — typique des paniers > 100 unités),
   * - `'percent'` sinon.
   *
   * NB : le composant peut ignorer le framing recommandé si la charte
   * graphique impose une seule forme — ce champ est purement consultatif.
   */
  framing: 'amount' | 'percent';
}

export function computePromo(
  priceCents: number,
  promoPriceCents: number | null | undefined,
): PromoComputation {
  const original = Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0;
  const promo =
    promoPriceCents !== null && promoPriceCents !== undefined && Number.isFinite(promoPriceCents)
      ? Math.max(0, Math.round(promoPriceCents))
      : null;

  const active = promo !== null && promo > 0 && promo < original;
  const savingsCents = active ? original - (promo as number) : 0;
  const savingsPct = active && original > 0 ? Math.round((savingsCents / original) * 100) : 0;

  // Heuristique Kolenda #34 : on compare la valeur numérique brute du
  // montant économisé (en unités majeures, ÷100) à la valeur du pourcentage.
  // Ex : 320 MAD avec 10 % → 32 (montant) vs 10 (pourcent) → on affiche le
  // montant. Ex : 50 EUR avec 25 % → 12.50 vs 25 → on affiche le pourcentage.
  const framing: PromoComputation['framing'] =
    active && savingsCents / 100 >= savingsPct ? 'amount' : 'percent';

  return {
    active,
    effectivePriceCents: active ? (promo as number) : original,
    originalPriceCents: original,
    savingsCents,
    savingsPct,
    framing,
  };
}

/**
 * Helper d'affichage pour le label « Économisez … » que <PriceDisplay>
 * affiche sous le prix barré. La devise est nécessaire pour le formatage
 * du montant (MAD/AED entier, EUR/USD avec décimales).
 *
 * Retourne `null` quand la promo n'est pas active — l'appelant peut alors
 * masquer entièrement la mention.
 */
export function formatPromoSavings(
  computation: PromoComputation,
  currency: Currency | string,
  formatPriceFn: (cents: number, currency: string) => string,
): string | null {
  if (!computation.active) return null;
  if (computation.framing === 'amount') {
    return `Économisez ${formatPriceFn(computation.savingsCents, currency)}`;
  }
  return `Économisez ${computation.savingsPct} %`;
}
