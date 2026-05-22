/**
 * Helpers purs pour projeter un `CartSnapshot` à partir des données DB
 * (product variant) ou des données mock.
 *
 * Pourquoi un helper isolé ?
 *  - Le `KitCommanderSectionBound` est un Server Component async qui appelle
 *    `getKitProductCached` (DB) → difficile à tester directement sans
 *    setup MSW/DB lourd.
 *  - La logique de projection (calcul promo + compareAt) doit être testée
 *    de manière exhaustive, surtout après le bug du hardcode 390 MAD.
 *  - Réutilisable si une autre surface (commander Mode B, panier full-page)
 *    doit construire un snapshot.
 *
 * Contrat compareAt :
 *  - Compare-at = prix régulier (`priceCents`) UNIQUEMENT si une promo est
 *    active (`promoPriceCents > 0` ET `promoPriceCents < priceCents`).
 *  - Sinon `compareAtPriceCents` et `compareAtTotalCents` restent
 *    `undefined` → le strike-through n'apparaît pas dans l'UI.
 */
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

export interface VariantPriceInput {
  sku: string;
  priceCents: number;
  promoPriceCents: number | null;
  currency: string;
  variantId?: string;
}

export interface ProjectCartSnapshotOptions {
  productName: string;
  quantity?: number;
}

/**
 * Détermine si une promo est active sur une variante donnée.
 * Critères strict (alignés avec PriceBlock + KitCommanderSectionBound) :
 *  - `promoPriceCents` doit être non-null
 *  - `promoPriceCents > 0` (zéro n'est pas une promo, c'est un bug data)
 *  - `promoPriceCents < priceCents` (sinon ce n'est pas une réduction)
 */
export function isPromoActive(variant: VariantPriceInput): boolean {
  return (
    variant.promoPriceCents !== null &&
    variant.promoPriceCents > 0 &&
    variant.promoPriceCents < variant.priceCents
  );
}

/**
 * Construit un `CartSnapshot` à partir d'une variante DB.
 * - `unitPriceCents` = `promoPriceCents` si promo active, sinon `priceCents`
 * - `compareAtPriceCents` = `priceCents` si promo active, sinon `undefined`
 * - `totalCents` = `unitPriceCents × quantity`
 * - `compareAtTotalCents` = `compareAtPriceCents × quantity` si défini
 */
export function projectCartSnapshotFromVariant(
  variant: VariantPriceInput,
  options: ProjectCartSnapshotOptions,
): CartSnapshot {
  const quantity = options.quantity ?? 1;
  const hasPromo = isPromoActive(variant);
  const unitPriceCents = hasPromo ? variant.promoPriceCents! : variant.priceCents;
  const compareAtPriceCents = hasPromo ? variant.priceCents : undefined;
  const totalCents = unitPriceCents * quantity;
  const compareAtTotalCents = compareAtPriceCents
    ? compareAtPriceCents * quantity
    : undefined;
  return {
    items: [
      {
        sku: variant.sku,
        name: options.productName,
        quantity,
        unitPriceCents,
        compareAtPriceCents,
        variantId: variant.variantId,
      },
    ],
    totalCents,
    compareAtTotalCents,
    currency: variant.currency,
  };
}
