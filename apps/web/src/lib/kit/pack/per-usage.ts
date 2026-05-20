/**
 * Helper pur — construit la microcopy « coût par soin » sous le prix
 * pack (Kolenda §4.6 — Pricing reframe : transformer un coût en mini
 * unité de consommation pour amortir la perception).
 *
 * Entrées : prix en centimes + nombre de jours/soins estimés.
 * Sortie : « ≈ 0,75 € par soin sur 30 jours » ou `null` si données
 * incohérentes.
 *
 * `currencyUnit` est facultatif (défaut `'€'`). Pour les produits en MAD,
 * passer `'MAD'` afin que la microcopy reste cohérente avec le prix XXL.
 */
export function buildPerUsageHint(
  priceCents: number,
  days: number,
  currencyUnit: string = '€',
): string | null {
  if (!Number.isFinite(priceCents) || !Number.isFinite(days)) return null;
  if (priceCents <= 0 || days <= 0) return null;

  const perDay = priceCents / 100 / days;
  const formatted = perDay.toFixed(2).replace('.', ',');
  return `≈ ${formatted} ${currencyUnit} par soin sur ${days} jours`;
}
