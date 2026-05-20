/**
 * Helpers de calcul d'économie « pack vs séparé » pour la section
 * « Le Pack » sur `/kit` (Kolenda §4.6 — Économie réelle).
 *
 * Les helpers sont **purs** : entrées en centimes, sortie en majeurs
 * (entiers EUR + pourcentage entier). Aucune dépendance React ni I/O.
 */

export interface PackSavings {
  /** Économie en EUR arrondie à l'entier supérieur ou inférieur le plus proche. */
  eur: number;
  /** Pourcentage entier (1..100). Minimum 1 % si une économie existe (pas 0 %). */
  pct: number;
}

/**
 * Calcule l'économie réalisée entre le prix séparé (`priceCompareAt`) et
 * le prix pack (`priceFinal`). Retourne `null` si :
 *  - pas de prix barré (null/undefined)
 *  - prix barré <= prix final (incohérence métier)
 *  - valeurs non finies ou négatives
 *
 * Le pourcentage est arrondi à l'entier. Pour éviter un libellé absurde
 * « économisez 0 % » sur une vraie micro-économie, le minimum affiché
 * est 1 %.
 */
export function computePackSavings(
  priceFinalCents: number,
  priceCompareAtCents: number | null | undefined,
): PackSavings | null {
  if (priceCompareAtCents === null || priceCompareAtCents === undefined) {
    return null;
  }
  if (!Number.isFinite(priceFinalCents) || !Number.isFinite(priceCompareAtCents)) {
    return null;
  }
  if (priceFinalCents < 0 || priceCompareAtCents <= 0) {
    return null;
  }
  if (priceCompareAtCents <= priceFinalCents) {
    return null;
  }

  const deltaCents = priceCompareAtCents - priceFinalCents;
  const eur = Math.round(deltaCents / 100);
  const rawPct = (deltaCents / priceCompareAtCents) * 100;
  const pct = Math.max(1, Math.round(rawPct));
  return { eur, pct };
}

/**
 * Formate le libellé de bandeau économie au format
 * `« Vous économisez {eur} € · {pct} % »`. Convention typographique
 * française : espace insécable U+00A0 avant `€`, `·` et `%`. La police
 * peut ainsi gérer la justification sans casser ces unités.
 */
export function formatSavingsLabel(savings: PackSavings): string {
  const NBSP = ' ';
  return `Vous économisez ${savings.eur}${NBSP}€${NBSP}·${NBSP}${savings.pct}${NBSP}%`;
}
