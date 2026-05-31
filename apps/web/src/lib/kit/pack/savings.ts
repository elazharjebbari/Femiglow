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
 * `« Vous économisez {amount} {unit} · {pct} % »`.
 *
 * - `currencyUnit` est l'unité affichée (défaut `'€'`). Pour les produits
 *   en MAD, passer `'MAD'` afin que le bandeau reste cohérent avec le
 *   prix XXL.
 * - Convention typographique française : espace insécable U+00A0 avant
 *   l'unité, `·` et `%`.
 * - `phraseTemplate` (Phase 7 wiring) : gabarit ICU localisé optionnel
 *   (placeholders `{amount}` / `{currency}` / `{pct}`). Fourni pour les
 *   locales non-défaut → interpolé tel quel (sa propre ponctuation prime).
 *   Absent → sortie FR byte-identique historique.
 */
export function formatSavingsLabel(
  savings: PackSavings,
  currencyUnit: string = '€',
  phraseTemplate?: string,
): string {
  if (phraseTemplate) {
    return phraseTemplate
      .replace('{amount}', String(savings.eur))
      .replace('{currency}', currencyUnit)
      .replace('{pct}', String(savings.pct));
  }
  const NBSP = ' ';
  return `Vous économisez ${savings.eur}${NBSP}${currencyUnit}${NBSP}·${NBSP}${savings.pct}${NBSP}%`;
}
