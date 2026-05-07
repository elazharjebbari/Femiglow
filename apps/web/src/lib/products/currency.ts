/**
 * Source de vérité unique pour les devises supportées par la plateforme
 * (catalogue + paniers + tracking + JSON-LD).
 *
 * Pourquoi un module dédié ?
 *  - éviter la duplication de l'enum (`schemas/product.ts`, `db/types.ts`,
 *    `format-price.ts`, factories de tests…),
 *  - exposer une métadonnée par devise (locale d'affichage par défaut,
 *    fraction-digits pour le formatage Intl) sans hard-coder dans les
 *    composants UI.
 *
 * Design notes
 *  - La colonne DB `product_variants.currency` reste `text` libre (pas de
 *    contrainte schéma SQL) ; la validation se fait dans Zod côté API.
 *  - L'ordre du tuple sert d'ordre d'affichage dans les sélecteurs admin.
 *  - `MAD` est devise par défaut (marché principal).
 */

export const SUPPORTED_CURRENCIES = [
  'MAD',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'AED',
] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'MAD';

export interface CurrencyDescriptor {
  /** Code ISO 4217. */
  code: Currency;
  /** Libellé humain (FR). */
  label: string;
  /** Symbole condensé (utilisé dans les listes serrées). */
  symbol: string;
  /** Locale Intl par défaut pour le formatage. */
  locale: string;
  /**
   * Nombre de décimales à afficher. MAD/AED suivent l'usage local
   * (entiers) plutôt que la convention ISO (2 décimales).
   */
  fractionDigits: number;
}

export const CURRENCY_DESCRIPTORS: Readonly<Record<Currency, CurrencyDescriptor>> = {
  MAD: { code: 'MAD', label: 'Dirham marocain', symbol: 'DH', locale: 'fr-MA', fractionDigits: 0 },
  EUR: { code: 'EUR', label: 'Euro', symbol: '€', locale: 'fr-FR', fractionDigits: 2 },
  USD: { code: 'USD', label: 'Dollar US', symbol: '$', locale: 'en-US', fractionDigits: 2 },
  GBP: { code: 'GBP', label: 'Livre sterling', symbol: '£', locale: 'en-GB', fractionDigits: 2 },
  CAD: { code: 'CAD', label: 'Dollar canadien', symbol: 'CA$', locale: 'fr-CA', fractionDigits: 2 },
  CHF: { code: 'CHF', label: 'Franc suisse', symbol: 'CHF', locale: 'fr-CH', fractionDigits: 2 },
  AED: { code: 'AED', label: 'Dirham émirati', symbol: 'د.إ', locale: 'ar-AE', fractionDigits: 0 },
};

/** Type-guard : `code` appartient-il à la liste supportée ? */
export function isSupportedCurrency(code: string | null | undefined): code is Currency {
  return typeof code === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

/**
 * Retourne le descripteur de la devise donnée, ou celui de
 * `DEFAULT_CURRENCY` en fallback (pas d'erreur — le formatage doit toujours
 * réussir, on n'aime pas crasher pour un libellé).
 */
export function describeCurrency(code: string | null | undefined): CurrencyDescriptor {
  return isSupportedCurrency(code) ? CURRENCY_DESCRIPTORS[code] : CURRENCY_DESCRIPTORS[DEFAULT_CURRENCY];
}

// ---------------------------------------------------------------------------
// Conversion cents ↔ unité majeure
// ---------------------------------------------------------------------------
//
// La DB stocke tous les prix en centimes (entiers) — `priceCents`,
// `promoPriceCents`. Les UI admin (et JSON-LD) ont besoin de présenter ces
// montants dans l'unité majeure attendue (29,00 EUR plutôt que 2900). Le
// nombre de décimales dépend de la devise : MAD/AED en entiers, EUR/USD/…
// avec deux décimales.

/**
 * Convertit des centimes (entier) vers la chaîne décimale attendue dans
 * un input texte (ex. `2900 + 'EUR' → "29.00"`, `2900 + 'MAD' → "29"`).
 *
 * - On utilise un point comme séparateur décimal (input HTML standard).
 * - `null`/`undefined`/`NaN` → chaîne vide pour faciliter le binding form.
 */
export function centsToMajor(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '';
  const desc = describeCurrency(currency);
  const major = cents / Math.pow(10, desc.fractionDigits);
  return major.toFixed(desc.fractionDigits);
}

/**
 * Convertit une saisie utilisateur (chaîne décimale, virgule ou point)
 * en centimes entiers selon la devise.
 *
 * - Retourne `null` si la saisie est vide ou non parseable (pas d'erreur ;
 *   l'appelant décide quoi en faire — par ex. promo vide → null en DB).
 * - Tolère « 29,00 », « 29.00 », « 29 », « 29,5 » (arrondi au plus proche).
 */
export function majorToCents(
  major: string | number | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (major === null || major === undefined) return null;
  const raw = typeof major === 'number' ? String(major) : major.trim();
  if (raw === '') return null;
  const normalized = raw.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  const desc = describeCurrency(currency);
  return Math.round(value * Math.pow(10, desc.fractionDigits));
}
