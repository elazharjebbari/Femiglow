# Architecture — Modèle de données

Trois tables : `products`, `product_variants`, `product_snapshots`.
Convention snake_case (Drizzle), Zod camelCase.

## `products`

Une ligne = une fiche produit éditable.

| Colonne              | Type        | Note |
|----------------------|-------------|------|
| `id`                 | uuid pk     | gen_random_uuid |
| `slug`               | text unique | identifiant stable, lowercase-kebab |
| `status`             | enum        | `'draft' \| 'published' \| 'archived'` |
| `title`              | text        | nom marketing |
| `tagline`            | text        | accroche courte |
| `description`        | text        | rich-text serialisé |
| `category`           | text        | `'soin' \| 'rituel' \| 'kit' \| ...` |
| `tags`               | jsonb       | `string[]` |
| `position`           | int         | tri dans listings |
| `featured`           | bool        | mise en avant home |
| `published_at`       | timestamptz | null si draft seul |
| `archived_at`        | timestamptz | soft delete |
| `created_at`         | timestamptz | |
| `updated_at`         | timestamptz | |
| `created_by`         | uuid        | FK users |

### Indices

- `UNIQUE (slug)`
- `INDEX (status, published_at DESC)` — listings front
- `INDEX (category)` — filtres admin

## `product_variants`

Une ligne = une déclinaison achetable.

| Colonne                | Type        | Note |
|------------------------|-------------|------|
| `id`                   | uuid pk     | |
| `product_id`           | uuid        | FK products, on delete cascade |
| `sku`                  | text        | unique par produit |
| `label`                | text        | ex: « 50 ml », « Édition limitée » |
| `price_cents`          | int         | en centimes (toujours entier) |
| `promo_price_cents`    | int         | nullable, doit être < `price_cents` |
| `currency`             | text        | défaut `'EUR'` (ISO 4217) |
| `inventory_status`     | enum        | `'available' \| 'low_stock' \| 'out_of_stock' \| 'preorder'` |
| `weight_g`             | int         | nullable, pour shipping futur |
| `attributes`           | jsonb       | `{ size?, scent?, ... }` |
| `position`             | int         | tri dans la liste de variantes |
| `created_at`           | timestamptz | |
| `updated_at`           | timestamptz | |

### Indices

- `UNIQUE (product_id, sku)`
- `INDEX (product_id, position)`
- `CHECK (promo_price_cents IS NULL OR promo_price_cents < price_cents)`

## `product_snapshots`

Historique des publications.

| Colonne        | Type        | Note |
|----------------|-------------|------|
| `id`           | uuid pk     | |
| `product_id`   | uuid        | FK products |
| `captured_at`  | timestamptz | défaut now() |
| `payload`      | jsonb       | `{ product, variants[] }` figé |
| `actor_id`     | uuid        | FK users |
| `note`         | text        | optionnel |

### Indices

- `INDEX (product_id, captured_at DESC)` — historique
- Rétention : conserver les 50 derniers par produit (job cron mensuel hors v1)

## Cascade draft → publish

1. PATCH met à jour les colonnes éditables, `updated_at` bouge
2. POST `/publish` :
   - Snapshot complet dans `product_snapshots`
   - `status = 'published'`, `published_at = now()`
   - `revalidateTag('products')` + `revalidateTag(\`product:${slug}\`)`
   - `logAuditEvent({ action: 'product.publish', diff })`

## Médias produit

Pas de table dédiée. Convention :

```
component_media_bindings.component_key = `product:${slug}`
component_media_bindings.slot          = 'packshot' | 'lifestyle' | 'gallery'
```

Le helper `resolveProductMedia(slug, slot)` lit ces bindings comme
n'importe quel composant. Les slots produit sont déclarés dans le
registre composants avec `siteComponents['product:*']`.

## i18n preparation

Pas de colonne `locale` en v1 (catalogue FR uniquement). L'extension
future passera par une table `product_translations (product_id,
locale, title, tagline, description)` plutôt qu'en dupliquant des
lignes — décision documentée dans `architecture/03-cascade.md`.

## Migration

Fichier : `apps/web/drizzle/migrations/0008_products_cms.sql`. Seed
peuple les fiches actuelles (kit, rituel, …) avec `status='published'`.
Détail dans [`runbook/01-deployment.md`](../runbook/01-deployment.md).
