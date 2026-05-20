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

/**
 * Couleurs d'accent reconnues pour la pastille numérotée d'un sous-produit
 * dans la section « La composition » du Kit.
 *
 * Palette Kolenda — `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` Annexe A :
 *  - `sauge` : `#A8B89E` (paste, verte sauge)
 *  - `petale` : `#F2CECC` (powder, rose poudré)
 *  - `ciel` : `#C5DBE5` (polissoir, bleu pierre)
 *  - `champagne` : `#B8956B` (or poudré, fallback / générique)
 */
export const subProductAccentColorSchema = z.enum([
  'sauge',
  'petale',
  'ciel',
  'champagne',
]);
export type SubProductAccentColor = z.infer<typeof subProductAccentColorSchema>;

export const subProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(),
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema).min(1),
  certifications: z.array(certificationSchema),

  /**
   * Phrase de sensation physique (italique Cormorant sous la description).
   * Ex. « Tiède au contact. », « Glisse, ne grise pas. ».
   *
   * Contraintes :
   *  - 1 à 80 caractères après trim,
   *  - se termine par une ponctuation (`.`, `!`, `?` ou guillemet français `»`)
   *    pour signaler une phrase complète à voix maison.
   *
   * Optionnel : si absent, le composant ne rend pas de ligne dédiée.
   * cf. Kolenda §4.3 — *induce sensation* (UX p. 8-9).
   */
  sensation: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(
      /[.!?»]$/,
      'sensation doit se terminer par une ponctuation finale (. ! ? »)',
    )
    .optional(),

  /**
   * Image contextuelle (main qui prend, table de chevet). Affichée par
   * crossfade au hover/tap au-dessus de `image`. Optionnelle — si absente,
   * `MediaCrossfade` n'expose pas l'interaction.
   */
  contextualImage: imageSchema.optional(),

  /**
   * Couleur d'accent du sous-produit. Sert à teinter la pastille numérotée
   * (et éventuellement la bordure au hover en phase 4). Décoratif uniquement.
   * `null` ou absent → fallback `champagne` côté résolveur.
   */
  accentColor: subProductAccentColorSchema.optional(),
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
