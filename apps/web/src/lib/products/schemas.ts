/**
 * Schémas Zod Products-CMS.
 * cf. docs/products-cms/backend/02-zod-validation.md
 */
import { z } from 'zod';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/products/currency';

/**
 * Devise variante : on accepte la liste blanche `SUPPORTED_CURRENCIES`,
 * normalisée en uppercase. La colonne DB reste `text` libre, mais l'API
 * publique impose l'enum pour éviter les divergences (ex. `eur` vs `EUR`).
 */
const variantCurrencySchema = z
  .string()
  .length(3)
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(SUPPORTED_CURRENCIES));

export const productStatusSchema = z.enum(['draft', 'published', 'archived']);
export const inventoryStatusSchema = z.enum([
  'available',
  'low_stock',
  'out_of_stock',
  'preorder',
]);

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalide (lowercase, kebab).');

export const skuSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'SKU invalide (UPPER, dots/underscore/dash).');

export const productCreateSchema = z
  .object({
    slug: slugSchema,
    title: z.string().min(1).max(120),
    category: z.string().min(1).max(40).optional(),
  })
  .strict();

export const productPatchSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    tagline: z.string().max(180).nullable().optional(),
    description: z.string().max(5000).nullable().optional(),
    category: z.string().min(1).max(40).nullable().optional(),
    tags: z.array(z.string().min(1).max(24)).max(20).optional(),
    position: z.number().int().min(0).max(9999).optional(),
    featured: z.boolean().optional(),
    status: productStatusSchema.optional(),
  })
  .strict();

export const productVariantUpsertSchema = z
  .object({
    sku: skuSchema,
    label: z.string().min(1).max(80),
    priceCents: z.number().int().positive(),
    promoPriceCents: z.number().int().positive().nullable().optional(),
    currency: variantCurrencySchema.default(DEFAULT_CURRENCY),
    inventoryStatus: inventoryStatusSchema.default('available'),
    weightG: z.number().int().positive().nullable().optional(),
    attributes: z.record(z.string(), z.string().max(120)).default({}),
    position: z.number().int().min(0).default(0),
  })
  .strict()
  .refine(
    (v) =>
      v.promoPriceCents === null ||
      v.promoPriceCents === undefined ||
      v.promoPriceCents < v.priceCents,
    { path: ['promoPriceCents'], message: 'promo doit être < prix.' },
  );

export const productVariantPatchSchema = z
  .object({
    sku: skuSchema.optional(),
    label: z.string().min(1).max(80).optional(),
    priceCents: z.number().int().positive().optional(),
    promoPriceCents: z.number().int().positive().nullable().optional(),
    currency: variantCurrencySchema.optional(),
    inventoryStatus: inventoryStatusSchema.optional(),
    weightG: z.number().int().positive().nullable().optional(),
    attributes: z.record(z.string(), z.string().max(120)).optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict();

export const reorderVariantsSchema = z
  .object({
    orderedVariantIds: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type ProductVariantUpsertInput = z.infer<typeof productVariantUpsertSchema>;
export type ProductVariantPatchInput = z.infer<typeof productVariantPatchSchema>;
