/**
 * Formate un montant en centimes vers une chaîne lisible adaptée à la devise.
 *
 * - Pour MAD/AED on suit l'usage local : « 320 MAD » (entier, suffixé code),
 *   en utilisant la locale fr-MA / ar-AE pour les groupements.
 * - Pour les devises ISO classiques (EUR/USD/GBP/CAD/CHF), on délègue
 *   intégralement à `Intl.NumberFormat` avec `style: 'currency'`.
 *
 * Si la devise n'est pas reconnue, on retombe sur la devise par défaut
 * (MAD) plutôt que de jeter — l'UI ne doit pas planter pour un libellé.
 */
import {
  DEFAULT_CURRENCY,
  describeCurrency,
  isSupportedCurrency,
  type Currency,
} from '@/lib/products/currency';

/**
 * Suffixe arabe pour les devises affichées « entier + code » (MAD/AED).
 * Phase 9 i18n STRICT : sur /ar, aucun latin ne doit fuiter → on remplace
 * le code ISO (MAD/AED) par son libellé arabe. Les chiffres restent latins
 * (cohérence de marque, cf. décision produit).
 */
const ARABIC_CURRENCY_SUFFIX: Partial<Record<Currency, string>> = {
  MAD: 'درهم',
  AED: 'درهم إماراتي',
};

export function formatPrice(
  amountInCents: number,
  currency: Currency | string = DEFAULT_CURRENCY,
  locale?: string,
): string {
  const desc = describeCurrency(currency);
  const amount = amountInCents / 100;
  // Devises où l'usage local est d'afficher en entier avec suffixe (MAD, AED).
  if (desc.fractionDigits === 0 && (desc.code === 'MAD' || desc.code === 'AED')) {
    const formatted = new Intl.NumberFormat(desc.locale, {
      maximumFractionDigits: 0,
    }).format(amount);
    // Sur /ar : suffixe arabe (درهم) au lieu du code latin. FR/EN inchangés
    // (locale absente ou ≠ 'ar') → sortie byte-identique aux usages legacy.
    if (locale === 'ar') {
      const suffix = ARABIC_CURRENCY_SUFFIX[desc.code] ?? desc.code;
      return `${formatted} ${suffix}`;
    }
    return `${formatted} ${desc.code}`;
  }
  // Cas standard : Intl.NumberFormat avec style `currency`.
  return new Intl.NumberFormat(desc.locale, {
    style: 'currency',
    // Si l'appelant a passé une devise non supportée, on formate avec
    // la devise par défaut (et non `currency`) pour rester cohérent
    // avec `describeCurrency()`.
    currency: isSupportedCurrency(currency) ? currency : DEFAULT_CURRENCY,
    minimumFractionDigits: desc.fractionDigits,
    maximumFractionDigits: desc.fractionDigits,
  }).format(amount);
}
