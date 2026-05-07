# Runbook — Déploiement Products-CMS

## Pré-requis

- Migration `0008_products_cms.sql` revue et appliquée
- Schémas Zod (`apps/web/src/lib/products/schemas.ts`)
- Helper `resolveProduct()` testé (cascade + fallback)
- Tests unitaires `getProduct`, `upsertProduct`, `publishProduct` ✅
- Slots produit déclarés dans `siteComponents['product:*']`

## Séquence de déploiement

### 1. Migration DB

```bash
pnpm --filter @femiglow/web drizzle:migrate
```

Vérifier :

```sql
SELECT count(*) FROM products;             -- 0 attendu
SELECT count(*) FROM product_variants;     -- 0 attendu
SELECT count(*) FROM product_snapshots;    -- 0 attendu
```

### 2. Seed catalogue actuel

Le seed `apps/web/src/lib/db/seeds/products-bootstrap.ts` insère
les fiches du registre codé avec `status='published'` :

```bash
pnpm --filter @femiglow/web db:seed -- products-bootstrap
```

À ce stade : DB et registre codé sont identiques. Le front rend
les mêmes pages qu'avant.

### 3. Migration des médias produit

Les médias existants (packshots, lifestyle, …) doivent être ajoutés
en tant que `component_media_bindings` avec :

```
component_key = `product:${slug}`
slot          = 'packshot' | 'lifestyle' | 'gallery'
```

Script : `pnpm --filter @femiglow/web db:seed -- product-media`.

### 4. Déploiement code

Push sur `main` → Vercel build automatique. Le build doit passer :

- `pnpm typecheck`
- `pnpm test:unit -- products-cms`
- `pnpm test:e2e -- products-cms`
- Lighthouse CI : pas de régression sur `/produits/[slug]`

### 5. Vérification post-deploy

1. `/admin/products` accessible (admin)
2. Liste affiche les fiches seedées
3. Ouvrir une fiche → tous les champs remplis depuis le seed
4. Modifier un titre → publier → vérifier sur `/produits/[slug]`
5. Ajouter une variante → vérifier qu'elle apparaît côté front

## Variables d'environnement

| Var                              | Description                          | Defaut |
|----------------------------------|--------------------------------------|--------|
| `PRODUCTS_DEFAULT_CURRENCY`      | ISO 4217 par défaut                  | EUR    |
| `PRODUCTS_SNAPSHOT_RETENTION`    | Nb max snapshots / produit           | 50     |

## Métriques à surveiller (J+1, J+7)

| Métrique                                   | Seuil acceptable |
|--------------------------------------------|------------------|
| Latence p95 `resolveProduct()`              | < 8 ms cached    |
| Cache miss rate `products`                  | < 2% / heure     |
| Erreurs 5xx sur `/api/admin/products/*`     | 0 / heure        |
| `product_variants` SKU collisions           | 0                |

## Rollback

### Rollback global (revenir au registre codé)

```sql
UPDATE products SET status = 'archived' WHERE status = 'published';
```

`resolveProduct()` fallback sur le registre codé pour chaque slug.
Puis `revalidateTag('products')`.

### Rollback ciblé

```sql
UPDATE products SET status = 'archived' WHERE slug = '<slug>';
```

→ La fiche revient au défaut codé. Le draft reste préservé.

### Rollback d'une variante mal pricée

```sql
UPDATE product_variants
SET price_cents = <ancien_prix>, promo_price_cents = NULL
WHERE id = '<variant_id>';
```

Puis revalidate. Investiguer ensuite via `audit_log` pour comprendre
qui a fait la modification.

## Communication

- Annoncer aux admins : `/admin/products` est dispo
- Workshop 30 min recommandé : montrer création produit → variantes
  → médias → publish
- Documenter la convention de slug dans le runbook équipe
  (`02-add-product.md`)
