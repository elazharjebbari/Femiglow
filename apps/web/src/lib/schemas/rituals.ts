import { z } from 'zod';

/**
 * Schémas Zod du composant « Rituels partagés ».
 * Source unique : types métier, validation runtime (API, formulaires, import).
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 3.
 */

// ---------------------------------------------------------------------------
// Catalogues de valeurs
// ---------------------------------------------------------------------------

export const RitualSignalSchema = z.enum(['oui', 'hesite', 'non']);
export type RitualSignal = z.infer<typeof RitualSignalSchema>;

export const RitualLanguageSchema = z.enum(['fr', 'ar']);
export type RitualLanguage = z.infer<typeof RitualLanguageSchema>;

/** Liste fermée des tags du catalogue maison. */
export const RITUAL_TAG_CATALOG = [
  'ongles-plus-lisses',
  'plaque-souple',
  'cuticules-apaisees',
  'plus-de-casse',
  'eclat-naturel',
  'rituel-devenu-habitude',
  'mains-detendues',
  'fini-brillant',
  'halal',
] as const;

export const RitualTagSchema = z.enum(RITUAL_TAG_CATALOG);
export type RitualTag = z.infer<typeof RitualTagSchema>;

/** Liste fermée des villes acceptées (autocomplete wizard). */
export const RITUAL_CITY_CATALOG = [
  'Rabat',
  'Casablanca',
  'Salé',
  'Tanger',
  'Marrakech',
  'Fès',
  'Agadir',
  'Oujda',
  'Tétouan',
  'Meknès',
  'Kénitra',
  'Autre',
] as const;

export const RitualCitySchema = z.enum(RITUAL_CITY_CATALOG);

// ---------------------------------------------------------------------------
// Photo publique (sortie API)
// ---------------------------------------------------------------------------

export const RitualPhotoPublicSchema = z.object({
  url: z.string().url(),
  thumbUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  position: z.number().int().min(0).max(2),
  alt: z.string().nullable().default(null),
});

export type RitualPhotoPublic = z.infer<typeof RitualPhotoPublicSchema>;

// ---------------------------------------------------------------------------
// Témoignage public (sortie API)
// ---------------------------------------------------------------------------

export const RitualSignatureSchema = z.object({
  firstName: z.string().min(1).max(30).nullable(),
  city: z.string().nullable(),
  initiatedSince: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format attendu : YYYY-MM')
    .nullable(),
  isAnonymous: z.boolean(),
  verifiedPurchase: z.boolean(),
});

export const RitualTestimonialPublicSchema = z.object({
  publicSlug: z.string().min(4).max(32),
  body: z.string().min(50).max(600),
  wouldRecommend: RitualSignalSchema,
  ritualTags: z.array(RitualTagSchema).max(3),
  signature: RitualSignatureSchema,
  language: RitualLanguageSchema,
  photos: z.array(RitualPhotoPublicSchema).max(3),
  publishedAt: z.string().datetime().nullable(),
});

export type RitualTestimonialPublic = z.infer<typeof RitualTestimonialPublicSchema>;

// ---------------------------------------------------------------------------
// Soumission publique (entrée POST /api/rituals/submit)
// ---------------------------------------------------------------------------

export const RitualPhotoUploadSchema = z.object({
  blobKey: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive().max(5 * 1024 * 1024),
  mime: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
});

export const RitualTestimonialSubmitSchema = z.object({
  productKey: z.string().min(1),
  body: z.string().min(50).max(600),
  wouldRecommend: RitualSignalSchema,
  ritualTags: z.array(RitualTagSchema).max(3).default([]),
  authorFirstName: z.string().min(1).max(30).nullable().default(null),
  authorCity: z.string().nullable().default(null),
  initiatedSince: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .nullable()
    .default(null),
  isAnonymous: z.boolean().default(false),
  language: RitualLanguageSchema.default('fr'),
  photos: z.array(RitualPhotoUploadSchema).max(3).default([]),
  emailToken: z.string().nullable().default(null),
  consentMarketing: z.boolean().default(false),
});

export type RitualTestimonialSubmit = z.infer<typeof RitualTestimonialSubmitSchema>;

// ---------------------------------------------------------------------------
// Synthèse agrégée (sortie GET /api/rituals/summary)
// ---------------------------------------------------------------------------

export const RitualSummarySchema = z.object({
  productKey: z.string(),
  totalCount: z.number().int().min(0),
  ouiCount: z.number().int().min(0),
  hesiteCount: z.number().int().min(0),
  nonCount: z.number().int().min(0),
  withPhotosCount: z.number().int().min(0),
  topTags: z
    .array(z.object({ tag: RitualTagSchema, count: z.number().int().min(0) }))
    .max(6),
  lastPublishedAt: z.string().datetime().nullable(),
});

export type RitualSummary = z.infer<typeof RitualSummarySchema>;

// ---------------------------------------------------------------------------
// Filtres + pagination (GET /api/rituals/list)
// ---------------------------------------------------------------------------

export const RitualListSortSchema = z
  .enum(['recommended', 'recent', 'helpful'])
  .default('recommended');

export const RitualListQuerySchema = z.object({
  productKey: z.string().min(1),
  withPhotos: z.boolean().optional(),
  tags: z.array(RitualTagSchema).optional(),
  signal: RitualSignalSchema.optional(),
  featured: z.boolean().optional(),
  sort: RitualListSortSchema,
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(24).default(12),
});

export type RitualListQuery = z.infer<typeof RitualListQuerySchema>;

// ---------------------------------------------------------------------------
// Action admin sur un témoignage
// ---------------------------------------------------------------------------

export const RitualAdminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), note: z.string().optional() }),
  z.object({ action: z.literal('reject'), note: z.string().min(1) }),
  z.object({ action: z.literal('hide'), note: z.string().min(1) }),
  z.object({ action: z.literal('restore'), note: z.string().optional() }),
  z.object({ action: z.literal('feature') }),
  z.object({ action: z.literal('unfeature') }),
  z.object({
    action: z.literal('correct'),
    newBody: z.string().min(50).max(600),
    note: z.string().min(1),
  }),
]);

export type RitualAdminAction = z.infer<typeof RitualAdminActionSchema>;
