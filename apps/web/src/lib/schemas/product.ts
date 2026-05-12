import { z } from 'zod';
import { imageSchema } from './common';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/products/currency';

export const ingredientSchema = z.object({
  name: z.string().min(1),
  origin: z.string().optional(),
  description: z.string().optional(),
  inci: z.string().optional(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const certificationSchema = z.object({
  label: z.string(),
  body: z.string(),
  badgeImage: imageSchema.optional(),
});
export type Certification = z.infer<typeof certificationSchema>;

export const ingredientDetailedSchema = z.object({
  name: z.string().min(1),
  inci: z.string().min(1),
  function: z.string().min(1),
  origin: z.string().min(1),
  concentrationPct: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
});
export type IngredientDetailed = z.infer<typeof ingredientDetailedSchema>;

export const subProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(),
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema).min(1),
  certifications: z.array(certificationSchema),
});
export type SubProduct = z.infer<typeof subProductSchema>;

export const comparatifRowSchema = z.object({
  axis: z.string(),
  vernis: z.string(),
  rituel: z.string(),
});
export type ComparatifRow = z.infer<typeof comparatifRowSchema>;

export const handsTestimonialSchema = z.object({
  id: z.string(),
  authorFirstName: z.string(),
  city: z.string().optional(),
  quote: z.string(),
  beforeImage: imageSchema,
  afterImage: imageSchema,
  initieeDepuis: z.string().optional(),
});
export type HandsTestimonial = z.infer<typeof handsTestimonialSchema>;

export const reassuranceIconSchema = z.enum(['shipping', 'return', 'payment']);
export type ReassuranceIcon = z.infer<typeof reassuranceIconSchema>;

export const reassuranceSchema = z.object({
  icon: reassuranceIconSchema,
  label: z.string(),
  detail: z.string().optional(),
});
export type Reassurance = z.infer<typeof reassuranceSchema>;

export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  priceCents: z.number().int().positive(),
  /**
   * Prix promotionnel optionnel (en centimes), strictement inférieur à
   * `priceCents` quand présent. Quand `null`, aucun rabais n'est affiché.
   *
   * Charte FemiGlow II.5 + VII.3 : on n'utilise PAS le vocabulaire « solde »,
   * « promo », « offre flash ». Le composant <PriceDisplay> matérialise la
   * remise par contraste typographique (prix barré en brume) plutôt que par
   * une étiquette criarde — voir `components/commerce/PriceDisplay.tsx`.
   */
  promoPriceCents: z.number().int().positive().nullable().default(null),
  currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
  images: z.array(imageSchema).min(1),
  composition: z.array(ingredientSchema),
  inStock: z.boolean().default(true),
  estimatedShipping: z.string().default('Rabat\u00A0: 24\u202Fh. Maroc\u00A0: 48 \u00E0 72\u202Fh. Livraison offerte.'),
  /**
   * CHA-233 — Identifiants de la variant primaire (DB). Optionnels car
   * le mock product n'a pas forcément de variant DB ; côté DB on les
   * renseigne via `buildKitPublicProduct`. Ils permettent au panier
   * client de transmettre le bon SKU/variantId à `/api/checkout/order`
   * sans deviner depuis le slug.
   */
  primaryVariantSku: z.string().min(1).max(80).optional(),
  primaryVariantId: z.string().min(8).max(120).optional(),
});
export type Product = z.infer<typeof productSchema>;
