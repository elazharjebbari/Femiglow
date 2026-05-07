# Testing — Handlers MSW

Mock Service Worker pour les tests Vitest et le mode dev navigateur.

Fichier : `apps/web/src/test/msw/handlers/products.ts`.

## Handlers exposés

```ts
import { http, HttpResponse } from 'msw';
import {
  makeProductFixture, makeVariantFixture, listProductsFixture,
} from '../fixtures/products';

export const productHandlers = [
  http.get('/api/admin/products', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(listProductsFixture({
      status: url.searchParams.get('status') ?? 'all',
      q: url.searchParams.get('q') ?? '',
    }));
  }),

  http.post('/api/admin/products', async ({ request }) => {
    const body = await request.json() as { slug: string; title: string };
    return HttpResponse.json(makeProductFixture(body), { status: 201 });
  }),

  http.get('/api/admin/products/:slug', ({ params }) => {
    return HttpResponse.json({
      product: makeProductFixture({ slug: params.slug as string }),
      variants: [
        makeVariantFixture({ productId: 'prod_1', sku: 'KIT-50' }),
        makeVariantFixture({ productId: 'prod_1', sku: 'KIT-100' }),
      ],
      media: { packshot: null, lifestyle: null, gallery: [] },
      recentSnapshots: [],
    });
  }),

  http.patch('/api/admin/products/:slug', async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({
      ...makeProductFixture({ slug: params.slug as string }),
      ...body,
    });
  }),

  http.post('/api/admin/products/:slug/publish', ({ params }) => {
    return HttpResponse.json({
      product: makeProductFixture({
        slug: params.slug as string,
        status: 'published',
        publishedAt: new Date().toISOString(),
      }),
      snapshotId: 'snap_test_1',
    });
  }),

  http.post('/api/admin/products/:slug/variants', async ({ request, params }) => {
    const body = await request.json() as Partial<ProductVariant>;
    return HttpResponse.json(makeVariantFixture({
      ...body,
      id: `var_new_${Date.now()}`,
    }), { status: 201 });
  }),

  http.patch('/api/admin/products/:slug/variants/:variantId',
    async ({ request, params }) => {
      const body = await request.json();
      return HttpResponse.json(makeVariantFixture({
        ...body,
        id: params.variantId as string,
      }));
    },
  ),

  http.delete('/api/admin/products/:slug/variants/:variantId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/admin/products/:slug/variants/reorder',
    async ({ request }) => {
      const body = await request.json() as { orderedVariantIds: string[] };
      return HttpResponse.json({
        variants: body.orderedVariantIds.map((id, i) =>
          makeVariantFixture({ id, position: i }),
        ),
      });
    },
  ),
];
```

## Fixtures (`apps/web/src/test/fixtures/products.ts`)

```ts
export function makeProductFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? 'prod_kit',
    slug: overrides.slug ?? 'kit',
    status: overrides.status ?? 'draft',
    title: overrides.title ?? 'Le Kit FemiGlow',
    tagline: overrides.tagline ?? 'Routine douce',
    description: overrides.description ?? null,
    category: overrides.category ?? 'kit',
    tags: overrides.tags ?? ['rituel', 'soin'],
    position: overrides.position ?? 0,
    featured: overrides.featured ?? false,
    publishedAt: overrides.publishedAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-12T08:00:00Z',
    createdBy: 'usr_admin_test',
  };
}

export function makeVariantFixture(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: overrides.id ?? 'var_kit_50',
    productId: overrides.productId ?? 'prod_kit',
    sku: overrides.sku ?? 'KIT-50',
    label: overrides.label ?? '50 ml',
    priceCents: overrides.priceCents ?? 4900,
    promoPriceCents: overrides.promoPriceCents ?? null,
    currency: overrides.currency ?? 'EUR',
    inventoryStatus: overrides.inventoryStatus ?? 'available',
    weightG: overrides.weightG ?? null,
    attributes: overrides.attributes ?? {},
    position: overrides.position ?? 0,
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-01T10:00:00Z',
  };
}
```

## Cas couverts

| Cas                          | Forçage |
|------------------------------|---------|
| Liste vide                   | `listProductsFixture({ q: 'inexistant' })` |
| Slug existe déjà             | resolver POST renvoie 409 |
| Validation Zod fail          | resolver renvoie 422 + issues |
| Publish sans variante        | resolver renvoie 422 NO_VARIANT |
| Variante SKU dup             | resolver POST variant renvoie 409 |
| Promo > prix                 | resolver renvoie 422 |
| Reorder ID inconnu           | resolver renvoie 404 |

## Mode override par test

```ts
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

test('UI affiche erreur si slug existe', async () => {
  server.use(
    http.post('/api/admin/products', () =>
      HttpResponse.json(
        { ok: false, error: { code: 'SLUG_EXISTS', message: 'Slug déjà pris.' } },
        { status: 409 },
      ),
    ),
  );
  // ...
});
```

`server.resetHandlers()` est appelé `afterEach` pour purger.

## Conventions

- Un handler par route (pas de switch interne)
- Body validé contre les schémas Zod réels (refus si payload invalide)
- IDs déterministes (`prod_kit`, `var_kit_50`, `snap_test_1`)
- `onUnhandledRequest: 'error'` (chaque fetch non-mocké throw)
