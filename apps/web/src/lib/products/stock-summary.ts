/** Stock d'un produit pour la liste admin : somme de ses variantes. */
export interface ProductStockSummary {
  effective: number;
  daysLeft: number | null;
  sellWhenOut: boolean;
}
