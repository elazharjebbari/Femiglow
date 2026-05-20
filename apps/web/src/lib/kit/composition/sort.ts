/**
 * Helper de tri pour la composition d'un sous-produit.
 *
 * Kolenda §4.5 — transparence par ordre décroissant : la cliente voit
 * l'ingrédient le plus présent en premier. Les ingrédients sans
 * `concentrationPct` sont placés en queue (préserve leur ordre source).
 *
 * Pur — pas de mutation, retourne une nouvelle référence.
 */

/**
 * Trie les ingrédients par `concentrationPct` décroissante.
 *
 * @param ingredients liste d'ingrédients à trier (toute structure compatible
 *   `{ concentrationPct?: number }` — autorise un usage avec
 *   `IngredientDetailed` ou patch admin)
 * @returns nouvelle liste triée, ordre stable pour les valeurs égales.
 */
export function sortByConcentrationDesc<I extends { concentrationPct?: number }>(
  ingredients: ReadonlyArray<I>,
): I[] {
  const withPct: I[] = [];
  const withoutPct: I[] = [];
  for (const ing of ingredients) {
    if (typeof ing.concentrationPct === 'number') withPct.push(ing);
    else withoutPct.push(ing);
  }
  withPct.sort((a, b) => (b.concentrationPct ?? 0) - (a.concentrationPct ?? 0));
  return [...withPct, ...withoutPct];
}
