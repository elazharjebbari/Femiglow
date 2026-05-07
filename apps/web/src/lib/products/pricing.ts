/**
 * Helpers de pricing partagés entre admin et front.
 * cf. docs/products-cms/frontend/02-variants-editor.md §C.3
 */

export interface FormatPriceInput {
  amountCents: number;
  currency?: string;
  locale?: string;
}

export function formatPrice({
  amountCents,
  currency = 'EUR',
  locale = 'fr-FR',
}: FormatPriceInput): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

export interface DiscountInput {
  priceCents: number;
  promoPriceCents: number | null | undefined;
}

export interface DiscountResult {
  /** Pourcentage entier arrondi (ex. 25 pour 25%). */
  percentage: number;
  /** Économie en centimes. */
  savedCents: number;
  /** Vrai uniquement si promoPriceCents valide (>0 et < priceCents). */
  applies: boolean;
}

export function computeDiscount({
  priceCents,
  promoPriceCents,
}: DiscountInput): DiscountResult {
  if (
    promoPriceCents === null ||
    promoPriceCents === undefined ||
    promoPriceCents <= 0 ||
    promoPriceCents >= priceCents
  ) {
    return { percentage: 0, savedCents: 0, applies: false };
  }
  const savedCents = priceCents - promoPriceCents;
  const percentage = Math.round((savedCents / priceCents) * 100);
  return { percentage, savedCents, applies: true };
}
