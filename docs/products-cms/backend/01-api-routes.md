# Backend — Routes API admin

Toutes les routes : `getAdminSession()`, `checkRateLimit()`, validation
Zod, `logAuditEvent()`, `revalidateTag('products')` si mutation.

Base : `apps/web/src/app/api/admin/products/`.

## Récapitulatif

| Méthode | Route                                                         | Action |
|---------|---------------------------------------------------------------|--------|
| GET     | `/api/admin/products`                                         | Liste paginée |
| POST    | `/api/admin/products`                                         | Créer fiche |
| GET     | `/api/admin/products/[slug]`                                  | Détail |
| PATCH   | `/api/admin/products/[slug]`                                  | Update draft |
| DELETE  | `/api/admin/products/[slug]`                                  | Archive (soft) |
| POST    | `/api/admin/products/[slug]/publish`                          | Publier |
| POST    | `/api/admin/products/[slug]/restore`                          | Restaurer snapshot |
| GET     | `/api/admin/products/[slug]/variants`                         | Liste variantes |
| POST    | `/api/admin/products/[slug]/variants`                         | Créer variante |
| PATCH   | `/api/admin/products/[slug]/variants/[variantId]`             | Update variante |
| DELETE  | `/api/admin/products/[slug]/variants/[variantId]`             | Supprimer variante |
| POST    | `/api/admin/products/[slug]/variants/reorder`                 | Réordonner |
| GET     | `/api/admin/products/[slug]/snapshots`                        | Historique |

## RBAC

| Action                        | Rôle minimum |
|-------------------------------|--------------|
| Read                          | editor       |
| Create / update draft         | editor       |
| Publish / archive / restore   | admin        |

## `GET /api/admin/products`

Query :

```ts
{
  status?: 'draft' | 'published' | 'archived' | 'all';
  category?: string;
  q?: string;            // recherche slug + title
  page?: number;
  pageSize?: number;     // défaut 20, max 100
  sort?: 'updated_at' | 'title' | 'position';
}
```

Réponse :

```ts
{
  items: Array<{
    id: string;
    slug: string;
    title: string;
    status: 'draft' | 'published' | 'archived';
    category: string;
    primaryPriceCents: number | null;       // prix de la première variante
    variantCount: number;
    publishedAt: string | null;
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

Rate limit : 60/min.

## `POST /api/admin/products`

Body :

```ts
{
  slug: string;          // unique, lowercase-kebab
  title: string;
  category?: string;
}
```

Crée une fiche `status='draft'`. Réponse : produit complet.

422 si slug existe déjà.

## `GET /api/admin/products/[slug]`

Réponse :

```ts
{
  product: Product;
  variants: ProductVariant[];
  media: { packshot: ResolvedMedia | null; lifestyle: …; gallery: ResolvedMedia[] };
  recentSnapshots: Array<{ id, capturedAt, actor }>;
}
```

## `PATCH /api/admin/products/[slug]`

Body : `productSchema.partial()`. Audit `product.draft_update`. Pas
de revalidate (draft ne change pas le rendu public).

## `POST /api/admin/products/[slug]/publish`

Body : `{ note?: string }`.

Comportement :

1. Charge produit + variantes
2. Validation : au moins 1 variante, au moins le packshot
3. Snapshot complet dans `product_snapshots`
4. `status = 'published'`, `published_at = now()`
5. `revalidateTag('products')` + `revalidateTag(\`product:${slug}\`)`
6. Audit avec diff vs snapshot précédent

422 si validations métier échouent.

## `POST /api/admin/products/[slug]/restore`

Body : `{ snapshotId: string }`.

Restaure le snapshot dans le draft (sans publier). Met à jour le
produit + variantes en transaction.

## Variantes

### `POST /api/admin/products/[slug]/variants`

Body :

```ts
{
  sku: string;
  label: string;
  priceCents: number;        // > 0
  promoPriceCents?: number;  // < priceCents
  currency?: string;         // défaut env
  inventoryStatus: 'available' | 'low_stock' | 'out_of_stock' | 'preorder';
  weightG?: number;
  attributes?: Record<string, string>;
}
```

422 si SKU déjà utilisé pour ce produit.

### `POST /api/admin/products/[slug]/variants/reorder`

Body : `{ orderedVariantIds: string[] }`.

Met à jour `position` en transaction. Retourne la liste mise à jour.

## Codes erreur

| Code | Cas |
|------|-----|
| 401  | Pas de session admin |
| 403  | Role insuffisant |
| 404  | Produit / variante / snapshot inconnu |
| 409  | Slug ou SKU déjà utilisé |
| 422  | Validation Zod / business rules |
| 429  | Rate limit |
| 500  | DB / cache failure |
