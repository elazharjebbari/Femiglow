/**
 * Cache tags Products-CMS — utilisés par revalidateTag.
 *
 * `revalidateProduct(slug)` centralise l'invalidation : tags `products` +
 * `product:<slug>` + `product-feed` (pour Google Merchant), et revalidation
 * du chemin public si le slug est piloté (ex. `/kit` <-> `le-kit`).
 *
 * Le tag `product-feed` est consommé par :
 *  - `lib/products/feed/cache.ts` (builder XML wrappé dans `unstable_cache`),
 *  - `app/feed.xml/route.ts` (revalidé en ISR + tag).
 *
 * Toute mutation produit (price, promo, status, archive, variants…) doit
 * passer par `revalidateProduct()` pour que `/feed.xml` reflète l'état
 * frais en < 5 s au lieu d'attendre la fenêtre ISR de 30 minutes.
 */
import { revalidatePath, revalidateTag } from 'next/cache';

export const PRODUCTS_TAG = 'products';
export const PRODUCT_FEED_TAG = 'product-feed';
export const productTag = (slug: string) => `product:${slug}`;

/**
 * Chemins publics globaux à revalider sur toute mutation produit
 * (indépendamment du slug). Inclut le feed Merchant et tous les endpoints
 * agrégés. Voir `SLUG_TO_PATHS` pour les chemins par-slug.
 */
const GLOBAL_PRODUCT_PATHS: readonly string[] = ['/feed.xml'];

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
  // Le feed Merchant agrège tous les produits publiés : toute mutation
  // doit l'invalider, même si le slug n'a pas de route publique dédiée.
  revalidateTag(PRODUCT_FEED_TAG);
  for (const path of SLUG_TO_PATHS[slug] ?? []) {
    revalidatePath(path);
  }
  for (const path of GLOBAL_PRODUCT_PATHS) {
    revalidatePath(path);
  }
}
