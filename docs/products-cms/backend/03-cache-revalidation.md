# Backend — Cache & revalidation

## Tags utilisés

| Tag                          | Quoi                                       | Invalidé par |
|------------------------------|--------------------------------------------|--------------|
| `products`                   | listings, registry global                  | publish, archive, restore, batch |
| `product:${slug}`            | détail d'un produit                        | publish, archive, restore, variants ops |
| `products:listings`          | RSC `/produits` (cache de la grille)       | publish, archive, reorder |

## Wrappers

### `resolveProduct(slug)`

```ts
import { unstable_cache } from 'next/cache';

export const resolveProduct = (slug: string) =>
  unstable_cache(
    () => _resolveProductImpl(slug),
    ['products', 'resolve', slug],
    {
      tags: ['products', `product:${slug}`],
      revalidate: 3600,
    },
  )();
```

### `listPublishedProducts()`

```ts
export const listPublishedProducts = unstable_cache(
  _listPublishedProductsImpl,
  ['products', 'list', 'published'],
  {
    tags: ['products', 'products:listings'],
    revalidate: 600,
  },
);
```

### `getRegistryProduct(slug)` (codé)

Pas de cache (lecture mémoire).

## Routes mutantes : revalidation

Schéma centralisé dans `apps/web/src/lib/products/cache.ts` :

```ts
export function invalidateProduct(slug: string): void {
  revalidateTag('products');
  revalidateTag(`product:${slug}`);
  revalidateTag('products:listings');
}
```

Chaque route admin appelle `invalidateProduct(slug)` *après* commit DB.

| Route                                    | Tags revalidés |
|------------------------------------------|----------------|
| PATCH `/api/admin/products/[slug]`       | aucun (draft, pas de rendu public) |
| POST  `/publish`                         | `products`, `product:${slug}`, `products:listings` |
| DELETE `/api/admin/products/[slug]`      | idem (archive) |
| POST  `/restore`                         | aucun (restore = nouveau draft) |
| variants POST/PATCH/DELETE/reorder       | aucun si produit en draft ; sinon `product:${slug}` |

→ Logique : tant que le produit n'est pas publié, modifier ses
variantes ne change rien au front.

## Cache HTTP (front)

`/produits/[slug]/page.tsx` :

```ts
export const revalidate = 3600;
export const dynamicParams = true;        // nouveaux slugs OK
```

`generateStaticParams()` lit `listPublishedProducts()` pour pré-build.

`/produits/page.tsx` (listing) : ISR 600s.

## Stratégie cache miss

À chaque `revalidateTag`, Next.js invalide la mémoire et le data
cache. Le prochain render rebuilt :

- p95 `_resolveProductImpl` cold : < 12 ms
- p95 `_listPublishedProductsImpl` cold : < 25 ms

Donc miss acceptable, pas de pré-warm nécessaire.

## Exception : OG image

OG image produit servie via `/api/og/product/[slug]` (cf. SEO-CMS) ;
ce cache vit sur le CDN (Cache-Control: public, s-maxage=3600). Au
publish d'un produit qui change le packshot :

```ts
invalidateProduct(slug);
revalidateTag(`seo:product:${slug}`);   // cross-module
```

## Mesure & alerte

Métriques exposées (custom Prometheus dans
`apps/web/src/lib/observability/metrics.ts`) :

- `products_cache_hits_total{tag}`
- `products_cache_misses_total{tag}`
- `products_resolve_duration_seconds_bucket{}`

Alerte si `cache_hit_rate < 0.95` sur 1 h glissante.

## Debugging

Endpoint admin caché : `GET /api/admin/cache/inspect?prefix=products`.
Renvoie la liste des entrées en cache + age. Utile en post-deploy.

## Anti-pattern

Ne **jamais** appeler `revalidatePath('/produits/...')` :

- moins ciblé que les tags
- ne propage pas aux composants imbriqués qui ont leurs propres caches

Toujours passer par les tags définis ci-dessus.
