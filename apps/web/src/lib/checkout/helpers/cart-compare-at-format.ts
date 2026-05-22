/**
 * Helper pur — formate le prix barré « compareAt » à partir d'un
 * `CartSnapshot`.
 *
 * Contrat :
 *  - Retourne une string formatée `"289 MAD"` UNIQUEMENT si :
 *      • `cart.compareAtTotalCents` est défini, ET
 *      • `cart.compareAtTotalCents > cart.totalCents` (sinon strike-through
 *        n'a aucun sens visuel).
 *  - Retourne `undefined` dans tous les autres cas (pas de promo, cart null,
 *    compareAt incohérent).
 *
 * Pourquoi un helper séparé ?
 *  - Logique non-triviale (deux conditions + format devise) qu'on veut
 *    pouvoir tester sans rendre le `WizardShell` entier dans vitest.
 *  - Réutilisable si une autre surface (panier full-page Mode B) doit
 *    afficher le même barré.
 */
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

export function formatCartCompareAt(
  cart: CartSnapshot | null | undefined,
): string | undefined {
  if (!cart) return undefined;
  if (cart.compareAtTotalCents === undefined) return undefined;
  if (cart.compareAtTotalCents <= cart.totalCents) return undefined;
  return `${(cart.compareAtTotalCents / 100).toFixed(0)} ${cart.currency}`;
}
