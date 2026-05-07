/**
 * Schémas Zod pour les routes API Components-CMS.
 *
 * Le **value** typé par FieldType est validé séparément via `validateFieldValue`
 * (cf. `@/lib/components/fields/validators`). Ici, on ne valide que le shape
 * du payload (`value` étant `unknown`).
 *
 * Cf. docs/components-cms/backend/01-api-routes.md.
 */
import { z } from 'zod';

/** Locale BCP-47 acceptée. v1 limité à 'fr', mais on accepte n'importe quelle string courte (forward-compat). */
const localeSchema = z.string().min(2).max(10).default('fr');

export const fieldPatchSchema = z.object({
  value: z.unknown(),
  locale: localeSchema,
});

export const fieldPublishSchema = z
  .object({
    notes: z.string().max(400).nullable().optional(),
  })
  .optional()
  .default({});

export const fieldScheduleSchema = z.object({
  scheduledAt: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'scheduledAt non parsable' }),
});

export const fieldRestoreSchema = z.object({
  historyId: z.string().min(3).max(64),
});

export const fieldHistoryQuerySchema = z.object({
  limit: z
    .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(100))
    .optional()
    .default(20),
  before: z
    .string()
    .optional()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), { message: 'before non parsable' }),
  locale: localeSchema.optional(),
});

export const fieldsListQuerySchema = z.object({
  locale: localeSchema.optional(),
});
