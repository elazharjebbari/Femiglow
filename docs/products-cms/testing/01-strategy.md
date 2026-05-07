# Testing — Stratégie

## Pyramide

```
                  ┌─────────────────┐
                  │   Playwright    │   ~7 scénarios
                  │   (e2e admin)   │
                  └─────────────────┘
              ┌──────────────────────────┐
              │   RTL composants admin    │   ~10 fichiers
              │   (VariantsEditor, …)     │
              └──────────────────────────┘
        ┌───────────────────────────────────┐
        │   Vitest unit                      │   ~25 fichiers
        │   (resolve, queries, business)     │
        └───────────────────────────────────┘
```

Cible coverage : **85%** sur `apps/web/src/lib/products/**` et
**70%** sur `apps/web/src/components/admin/products/**`.

## Couches testées

### 1. `resolveProduct()` (unit, Vitest)

- Cascade complète (registre → DB published → merge)
- Fallback si DB row absent
- DB archived → null
- Variantes : DB-wins-totalement
- Cache `unstable_cache` invalidé par tag

### 2. Queries Drizzle (unit, Vitest avec testcontainers Postgres)

- `upsertProduct` UNIQUE slug
- `publishProduct` snapshot + status + revalidate
- `archiveProduct` soft delete
- `restoreSnapshot` réinitialise draft
- Variants CRUD + reorder + UNIQUE (product_id, sku)
- Constraints : `promo < price` au DB level

### 3. Routes API (unit, Vitest avec MSW + supertest)

- 401/403/404/422/429 paths
- Audit log écrit pour chaque mutation
- `revalidateTag` appelé après publish/archive
- Business rules :
  - Slug unique au create
  - Au publish : ≥ 1 variante + packshot présent
  - Restore snapshot legacy → 422 si schéma incompatible

### 4. Composants admin (RTL)

- `ProductGeneralForm` save optimiste + dirty tracking
- `VariantsEditor` ajout / édition / drop reorder / suppression
- `PriceField` parsing FR/EN
- `ProductMediaPanel` intégration SlotCard
- `ProductHistoryPanel` restore + diff

### 5. Helpers RSC

- `<ProductPackshot>` rend ResponsiveImage si binding, fallback si non
- `<ProductGallery>` masquée si gallery vide
- Cascade : registre seul, DB seul, hybride

### 6. Parcours e2e (Playwright)

Cf. [`03-playwright-scenarios.md`](./03-playwright-scenarios.md).

## Non-tests

- Pixel-perfect des cards produit (visual regression hors scope v1)
- Performance des queries (déléguée aux benchmarks DB séparés)
- Intégration paiement (hors scope module)

## Fixtures

- `apps/web/src/lib/products/__fixtures__/products.ts` — 6 produits type
- `apps/web/src/lib/products/__fixtures__/cascade-cases.ts` — 6 cas cascade
- `apps/web/src/lib/products/__fixtures__/zod-cases.ts` — 30+ cas validation
- `apps/web/test/fixtures/product-snapshots.ts` — snapshots restorables

## Setup testcontainers

`apps/web/test/setup-db.ts` :

```ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withExposedPorts(5432)
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
  await runMigrations();
  await seedTestProducts();
});

afterAll(async () => {
  await container?.stop();
});
```

Tests Vitest qui ont besoin de DB : tag `@db` (run isolé en CI).

## Règle d'or

Chaque PR qui ajoute une route ou modifie la cascade ajoute :

1. Un test Vitest unit (cas nominal + 1 cas erreur)
2. Un fixture documenté si nouveau cas business
3. Un handler MSW si nouvelle route
4. Optionnel : un scénario Playwright si nouveau parcours admin
