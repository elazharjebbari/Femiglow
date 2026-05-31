/**
 * Cache layer pour le feed XML kit FemiGlow.
 *
 * Pourquoi un cache supplémentaire alors que `buildKitPublicProduct`
 * est déjà cached ?
 *
 *  1. **Cohérence intra-fenêtre** — Le body XML embarque
 *     `<lastBuildDate>` (RFC 822). Sans cache au niveau body, deux
 *     requêtes consécutives obtiennent deux `new Date()` différents,
 *     ce qui change la string XML, ce qui change l'ETag (SHA-256
 *     content-based). Conséquence : `If-None-Match` ne matche jamais
 *     et le conditional GET (304) ne se déclenche jamais en prod.
 *     En cachant `{ body, etag, lastModifiedISO }` ensemble, tous les
 *     consommateurs voient la même version pendant la fenêtre.
 *
 *  2. **Amortissement DB** — Bien que `buildKitPublicProduct` soit
 *     cached, la sérialisation XML elle-même (`merchantFeedXml`) +
 *     l'appel `cms.getKitPageContent()` (CMS adapter, pas
 *     systématiquement cached) ont un coût. Cacher la sortie finale
 *     évite de re-faire cette chaîne à chaque hit.
 *
 *  3. **Invalidation tag-driven** — `revalidateProduct(slug)` purge
 *     `PRODUCT_FEED_TAG`. Toute mutation produit déclenche donc un
 *     re-build < 5 s côté Merchant, sans attendre les 30 min ISR.
 *
 * Note technique : `unstable_cache` sérialise via JSON. On ne peut pas
 * y stocker une `Date` (deviendrait string puis ne serait pas
 * rehydratée). On expose `lastModifiedISO: string` et on rehydrate
 * côté appelant.
 */
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';

import { cms } from '@/lib/cms';
import { PRODUCT_FEED_TAG, productTag } from '@/lib/products/cache';
import { buildKitPublicProduct, KIT_PRODUCT_SLUG } from '@/lib/products/public';
import { getProductReviewStats } from '@/lib/products/reviews';

import { buildKitProductFeed } from './kit-feed';
import { merchantFeedXml } from './merchant-xml';

/**
 * Tuple complet exposé par le cache.
 *
 * On embarque les champs télémétrie (`productSlug`, `availability`…)
 * en plus du `body`, pour que le route handler puisse logger sans
 * re-parser le XML ni re-appeler le builder.
 */
export interface CachedFeedXml {
  /** Body XML complet, prêt à servir tel quel. */
  body: string;
  /** ETag forme strong : `"<sha256-hex>"` (entouré de guillemets, sans `W/`). */
  etag: string;
  /**
   * Date de build (= `<lastBuildDate>` du XML), sérialisée ISO 8601.
   * Le route handler la rehydrate via `new Date(lastModifiedISO)`.
   */
  lastModifiedISO: string;
  /** Slug produit (pour log structuré). */
  productSlug: string;
  /** Disponibilité au moment du build. */
  availability: 'in_stock' | 'out_of_stock';
  /** Prix en majeurs (pour log structuré et alertes pricing). */
  priceMajor: number;
  /** Devise du prix (pour log structuré). */
  currency: string;
  /** URL absolue de l'image Merchant retenue (pour log + diagnostic SVG). */
  imageUrl: string;
}

/**
 * SHA-256 du body, encodé hex, entouré de guillemets (forme strong
 * RFC 7232 §2.3 — sans préfixe `W/`).
 */
function computeEtag(body: string): string {
  const digest = createHash('sha256').update(body, 'utf8').digest('hex');
  return `"${digest}"`;
}

/**
 * Inner function — non cached. Exporté **uniquement** pour les tests
 * qui doivent contourner `unstable_cache` (l'invariant
 * `incrementalCache missing` claque hors runtime Next.js).
 *
 * En prod, n'appelez **jamais** cette fonction directement : passez
 * toujours par `getCachedKitFeedXml`.
 */
export async function buildKitFeedXmlUncached(): Promise<CachedFeedXml> {
  const [content, product] = await Promise.all([
    cms.getKitPageContent(),
    buildKitPublicProduct(),
  ]);
  // `getProductReviewStats` retourne null si aucune review en base — le
  // builder retombe alors automatiquement sur `DEFAULT_KIT_REVIEW_STATS`.
  // On passe `product.id` (et pas le slug) pour respecter le schéma DB
  // (foreign key par id, pas par slug).
  const stats = await getProductReviewStats(product.id);
  const feed = buildKitProductFeed(product, content, stats);
  const lastModified = new Date();
  const body = merchantFeedXml(feed, { lastBuildDate: lastModified });
  const etag = computeEtag(body);
  return {
    body,
    etag,
    lastModifiedISO: lastModified.toISOString(),
    productSlug: feed.productSlug,
    availability: feed.availability,
    priceMajor: feed.priceMajor,
    currency: feed.currency,
    imageUrl: feed.imageUrl,
  };
}

/**
 * Version cached : à utiliser depuis le route handler `/feed.xml`.
 *
 * - Clé de cache : `['product-feed:kit:v1']`. Bumper `v1` si on change
 *   la forme de `CachedFeedXml` (sinon les serveurs déjà chauds
 *   continueraient à servir l'ancien shape jusqu'à expiration).
 * - Tags : `PRODUCT_FEED_TAG` (générique) + `productTag(KIT_PRODUCT_SLUG)`
 *   (spécifique kit). `revalidateProduct('le-kit')` purge les deux.
 * - `revalidate: 1800` — fenêtre par défaut alignée sur l'ISR du
 *   route handler. La purge tag-driven prime côté admin.
 */
export const getCachedKitFeedXml = unstable_cache(
  buildKitFeedXmlUncached,
  ['product-feed:kit:v1'],
  {
    tags: [PRODUCT_FEED_TAG, productTag(KIT_PRODUCT_SLUG)],
    revalidate: 1800,
  },
);
