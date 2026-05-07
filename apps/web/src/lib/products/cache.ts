/**
 * Cache tags Products-CMS — utilisés par revalidateTag.
 *
 * `revalidateProduct(slug)` centralise l'invalidation : tags `products` +
 * `product:<slug>`, et revalidation du chemin public si le slug est piloté
 * (ex. `/kit` <-> `le-kit`).
 */
import { revalidatePath, revalidateTag } from 'next/cache';

export const PRODUCTS_TAG = 'products';
export const productTag = (slug: string) => `product:${slug}`;

/**
 * Mapping slug produit → chemins publics où il est rendu.
 *
 * Source de vérité unique pour :
 *  - `revalidateProduct()` (invalidation ISR ciblée),
 *  - l'admin (lien « Voir sur la vitrine » + bandeau de synchronisation).
 *
 * Ajouter ici quand un produit est exposé sur une nouvelle route publique.
 */
const SLUG_TO_PATHS: Record<string, string[]> = {
  'le-kit': ['/kit'],
};

/**
 * Retourne le premier chemin public où le produit `slug` est rendu, ou
 * `undefined` si le produit n'est exposé sur aucune route publique connue.
 *
 * Utilisé côté admin pour afficher un lien « Voir sur la vitrine » et
 * matérialiser la synchronisation avec la page publique.
 */
export function getProductPublicHref(slug: string): string | undefined {
  return SLUG_TO_PATHS[slug]?.[0];
}

export function revalidateProduct(slug: string): void {
  revalidateTag(PRODUCTS_TAG);
  revalidateTag(productTag(slug));
  for (const path of SLUG_TO_PATHS[slug] ?? []) {
    revalidatePath(path);
  }
}
