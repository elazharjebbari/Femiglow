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

export function formatPrice(
  amountInCents: number,
  currency: Currency | string = DEFAULT_CURRENCY,
): string {
  const desc = describeCurrency(currency);
  const amount = amountInCents / 100;
  // Devises où l'usage local est d'afficher en entier avec suffixe (MAD, AED).
  if (desc.fractionDigits === 0 && (desc.code === 'MAD' || desc.code === 'AED')) {
    const formatted = new Intl.NumberFormat(desc.locale, {
      maximumFractionDigits: 0,
    }).format(amount);
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
