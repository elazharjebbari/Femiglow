# Backend — Validation Zod

Schémas dans `apps/web/src/lib/products/schemas.ts`. Source de vérité
unique partagée routes API / queries / form handlers.

## Schémas exportés

```ts
export const productStatusSchema = z.enum(['draft', 'published', 'archived']);
export const inventoryStatusSchema = z.enum([
  'available', 'low_stock', 'out_of_stock', 'preorder',
]);

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalide (lowercase, kebab)');

export const skuSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'SKU invalide (UPPER, dots/underscore/dash)');

export const productSchema = z.object({
  slug: slugSchema,
  status: productStatusSchema.default('draft'),
  title: z.string().min(1).max(120),
  tagline: z.string().max(180).nullable(),
  description: z.string().max(5000).nullable(),       // markdown / JSON rich-text
  category: z.string().min(1).max(40).nullable(),
  tags: z.array(z.string().min(1).max(24)).max(20).default([]),
  position: z.number().int().min(0).max(9999).default(0),
  featured: z.boolean().default(false),
});

export const productVariantSchema = z.object({
  sku: skuSchema,
  label: z.string().min(1).max(80),
  priceCents: z.number().int().positive(),
  promoPriceCents: z.number().int().positive().nullable(),
  currency: z.string().length(3).default('EUR'),
  inventoryStatus: inventoryStatusSchema.default('available'),
  weightG: z.number().int().positive().nullable(),
  attributes: z.record(z.string(), z.string().max(120)).default({}),
  position: z.number().int().min(0).default(0),
}).refine(
  (v) => v.promoPriceCents === null || v.promoPriceCents < v.priceCents,
  { path: ['promoPriceCents'], message: 'promo doit être < prix' },
);
```

## Sanitization

- `title`, `tagline`, `label` : trim + collapse whitespace
- `slug` : lower-case forcé avant Zod (les utilisateurs typent en
  CamelCase)
- `sku` : upper-case forcé
- `tags` : dedup + trim côté serveur
- `description` : pas touchée (rich-text) ; sanitization HTML faite
  par le helper `sanitizeRichText` au render, pas au stockage

## Validations métier

Au-delà de Zod, certaines règles vivent dans `assertProductBusiness`
appelée par les routes :

```ts
function assertProductBusiness(input: ProductInput, opts: {
  existing?: Product;
  variants: ProductVariantInput[];
}) {
  // Slug unique (déjà DB UNIQUE, mais on veut un message UX)
  if (opts.existing && opts.existing.slug !== input.slug) {
    throw new BusinessError('SLUG_CHANGE_FORBIDDEN', 'Slug non modifiable.');
  }
  // SKU uniques par produit
  const skus = opts.variants.map(v => v.sku);
  if (new Set(skus).size !== skus.length) {
    throw new BusinessError('SKU_DUPLICATE', 'SKUs en double.');
  }
  // Au publish : au moins 1 variante
  if (input.status === 'published' && opts.variants.length === 0) {
    throw new BusinessError('NO_VARIANT', 'Au moins 1 variante au publish.');
  }
}
```

## Erreurs renvoyées

Format `error_envelope` aligné autres modules :

```ts
{
  ok: false,
  error: {
    code: 'VALIDATION_ERROR' | 'SLUG_CHANGE_FORBIDDEN' | ...,
    message: string,        // FR humanisé
    issues?: ZodIssue[],    // si VALIDATION_ERROR
  },
}
```

## Tests

Fixtures dans `__fixtures__/zod-cases.ts` :

- 12 cas valides (slug, SKU, prix, promo cohérent, …)
- 30 cas invalides (un par règle)
- 5 cas business (slug change, SKU dup, no variant publish, …)

Coverage cible : 100% des branches Zod et 100% des branches business.

## Round-trip Drizzle ↔ Zod

`apps/web/src/lib/products/queries.ts` :

```ts
function toRow(input: ProductInput): ProductsInsert { ... }
function fromRow(row: ProductsRow): Product { ... }
function toVariantRow(input: ProductVariantInput, productId: string): ProductVariantsInsert { ... }
```

Drizzle utilise snake_case + cents (int) ; Zod camelCase + cents.
Mapping explicite, pas de magie.
