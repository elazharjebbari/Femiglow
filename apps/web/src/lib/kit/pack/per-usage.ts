/**
 * Helper pur — construit la microcopy « coût par soin » sous le prix
 * pack (Kolenda §4.6 — Pricing reframe : transformer un coût en mini
 * unité de consommation pour amortir la perception).
 *
 * Entrées : prix en centimes + nombre de jours/soins estimés.
 * Sortie : « ≈ 0,75 € par soin sur 30 jours » ou `null` si données
 * incohérentes.
 */
export function buildPerUsageHint(
  priceCents: number,
  days: number,
): string | null {
  if (!Number.isFinite(priceCents) || !Number.isFinite(days)) return null;
  if (priceCents <= 0 || days <= 0) return null;

  const eurPerDay = priceCents / 100 / days;
  const formatted = eurPerDay.toFixed(2).replace('.', ',');
  return `≈ ${formatted} € par soin sur ${days} jours`;
}
