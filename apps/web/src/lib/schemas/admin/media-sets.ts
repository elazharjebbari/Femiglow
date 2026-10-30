/**
 * Schémas Zod — routes admin « médias par audience »
 * (`/api/admin/components/[key]/media-sets/**`).
 *
 * Ces schémas ne valident que la FORME des payloads (types, longueurs,
 * formats). La cohérence métier — slot déclaré par la politique du
 * composant, dimension et clé valides, `maxItems`, médias existants et non
 * supprimés — est vérifiée par la couche requêtes (`validateMediaSetShape`,
 * `assertMediaAvailable`) et remonte en 422 avec la liste des problèmes.
 * Un slot inconnu mais bien formé passe donc ici et échoue en 422.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { z } from 'zod';
import { LOCALES } from '@/i18n.config';
import { MEDIA_SET_LIST_HARD_CAP, MEDIA_SET_LOCALES } from '@/lib/components/media-variants/policy';

/* ──────────────────────────────────────────────────────────────────
 * Briques
 * ────────────────────────────────────────────────────────────────── */

/** Clé de slot (`primary`, `secondary`…) : slug court. */
const slotSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Slot invalide');

/** Dimension : `default`, `angle`, `ab:<expKey>`. */
const variantDimSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_:-]*$/, 'Dimension invalide');

/** Clé de variante : `*` ou slug (`a`…`e`, `temoin`, bras A/B). */
const variantKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^(\*|[a-z0-9][a-z0-9_-]*)$/, 'Clé de variante invalide');

/** Langue d'un ensemble : une locale du site ou `*`. */
const setLocaleSchema = z
  .string()
  .refine((v) => MEDIA_SET_LOCALES.includes(v), { message: 'Langue invalide' });

/** Identifiant opaque (média, ensemble, historique). */
const idSchema = z.string().min(1).max(64);

/** Horodatage ISO parsable (If-Match dans le corps). */
const isoDateSchema = z
  .string()
  .min(1)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Date non parsable' });

const objectPositionSchema = z.enum([
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
]);

/** Alt par langue (300 caractères max, aligné sur `validateMediaSetShape`). */
const altSchema = z
  .object({
    fr: z.string().max(300).optional(),
    ar: z.string().max(300).optional(),
    en: z.string().max(300).optional(),
  })
  .strict();

const focalSchema = z.number().int().min(0).max(100);

export const mediaSetItemSchema = z
  .object({
    mediaId: idSchema,
    mobileMediaId: idSchema.nullable().optional(),
    alt: altSchema.nullable().optional(),
    objectPosition: objectPositionSchema.nullable().optional(),
    focalX: focalSchema.nullable().optional(),
    focalY: focalSchema.nullable().optional(),
  })
  .strict();

const notesSchema = z.string().max(400).nullable().optional();

/* ──────────────────────────────────────────────────────────────────
 * Corps des mutations
 * ────────────────────────────────────────────────────────────────── */

/** `PUT /draft` — remplace le brouillon du tuple (liste complète et ordonnée). */
export const mediaSetDraftSchema = z
  .object({
    slot: slotSchema,
    variantDim: variantDimSchema.default('default'),
    variantKey: variantKeySchema.default('*'),
    locale: setLocaleSchema.default('*'),
    crossLocale: z.boolean().optional(),
    // Plafond absolu ; le plafond du slot (`maxItems`) est vérifié en 422.
    items: z.array(mediaSetItemSchema).max(MEDIA_SET_LIST_HARD_CAP),
    notes: notesSchema,
    /** Alternative au header `If-Match` (le header est prioritaire). */
    expectedUpdatedAt: isoDateSchema.optional(),
  })
  .strict();
export type MediaSetDraftPayload = z.infer<typeof mediaSetDraftSchema>;

/** Corps commun des transitions (`publish`, `cancel-schedule`, `unpublish`, `DELETE`). */
export const mediaSetMutationSchema = z
  .object({
    notes: notesSchema,
    expectedUpdatedAt: isoDateSchema.optional(),
  })
  .strict();

/** `POST /[setId]/schedule` — date future (≥ 1 minute, revérifié côté requêtes). */
export const mediaSetScheduleSchema = z
  .object({
    scheduledAt: isoDateSchema.refine((s) => Date.parse(s) > Date.now(), {
      message: 'scheduledAt doit être dans le futur',
    }),
    expectedUpdatedAt: isoDateSchema.optional(),
  })
  .strict();

/** `POST /restore` — restaure une entrée d'historique en brouillon. */
export const mediaSetRestoreSchema = z
  .object({
    historyId: idSchema,
    expectedUpdatedAt: isoDateSchema.optional(),
  })
  .strict();

/**
 * `POST /bulk-publish` — publie les brouillons correspondant au filtre.
 * Garde-fou : un filtre vide ne publie RIEN par accident — il faut au moins
 * un critère, ou `all: true` explicite (et alors aucun critère).
 */
export const mediaSetBulkPublishSchema = z
  .object({
    filter: z
      .object({
        slot: slotSchema.optional(),
        variantDim: variantDimSchema.optional(),
        variantKey: variantKeySchema.optional(),
        locale: setLocaleSchema.optional(),
        source: z.enum(['import', 'admin']).optional(),
      })
      .strict()
      .default({}),
    /** Publier TOUS les brouillons du composant (filtre vide obligatoire). */
    all: z.literal(true).optional(),
    dryRun: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    const hasFilter = Object.values(v.filter).some((x) => x !== undefined);
    if (!hasFilter && !v.all) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['filter'],
        message: 'Filtre vide : précisez au moins un critère, ou `all: true` pour tout publier',
      });
    }
    if (hasFilter && v.all) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['all'],
        message: '`all: true` ne se combine pas avec un filtre',
      });
    }
  });
export type MediaSetBulkPublishPayload = z.infer<typeof mediaSetBulkPublishSchema>;

/* ──────────────────────────────────────────────────────────────────
 * Query strings
 * ────────────────────────────────────────────────────────────────── */

/** `GET /` — filtres de la liste. */
export const mediaSetListQuerySchema = z
  .object({
    status: z.enum(['draft', 'published', 'scheduled', 'archived', 'all']).optional(),
    slot: slotSchema.optional(),
    variantDim: variantDimSchema.optional(),
    variantKey: variantKeySchema.optional(),
    locale: setLocaleSchema.optional(),
    /** Pagination, appliquée seulement avec `status=archived|all`. */
    limit: z
      .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(500))
      .optional()
      .default(100),
    offset: z
      .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(0).max(100_000))
      .optional()
      .default(0),
  })
  .strict();

/** `GET /history` — tuple complet + pagination simple. */
export const mediaSetHistoryQuerySchema = z
  .object({
    slot: slotSchema,
    variantDim: variantDimSchema.default('default'),
    variantKey: variantKeySchema.default('*'),
    locale: setLocaleSchema.default('*'),
    limit: z
      .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(100))
      .optional()
      .default(20),
  })
  .strict();

const booleanFlagSchema = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

/**
 * `GET /resolve` — contexte d'audience simulé. Les clés de dimension
 * (`angle`, `ab:<exp>`…) sont lues à part, d'après la politique.
 */
export const mediaSetResolveQuerySchema = z.object({
  locale: z.enum(LOCALES).default('fr'),
  draft: booleanFlagSchema,
});

/** Lit une query string en objet (première valeur par clé, clés autorisées seulement). */
export function pickSearchParams<K extends string>(
  url: URL,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null && value !== '') out[key] = value;
  }
  return out;
}
