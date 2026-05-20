/**
 * Schemas Zod pour les mutations admin de la composition `/kit`.
 *
 * `kitCompositionOverrideUpsertSchema` accepte un patch partiel sur un
 * sous-produit identifié par `subProductId`. Tous les champs sont
 * optionnels (`null` autorisé = reset au mock).
 */
import { z } from 'zod';

import {
  certificationSchema,
  ingredientDetailedSchema,
  subProductAccentColorSchema,
} from '@/lib/schemas/product';
import { KIT_COMPOSITION_SUB_PRODUCT_IDS } from './types';

const narrativeSchema = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .regex(/[.!?»]$/, 'narrative doit se terminer par une ponctuation finale');

const usageHintSchema = z.string().trim().min(1).max(60);

export const kitCompositionOverrideUpsertSchema = z.object({
  subProductId: z.enum(KIT_COMPOSITION_SUB_PRODUCT_IDS),
  narrative: narrativeSchema.nullable().optional(),
  usageHint: usageHintSchema.nullable().optional(),
  accentColor: subProductAccentColorSchema.nullable().optional(),
  ingredients: z
    .array(ingredientDetailedSchema)
    .min(1)
    .max(20)
    .nullable()
    .optional(),
  certifications: z
    .array(certificationSchema)
    .max(8)
    .nullable()
    .optional(),
});

export type KitCompositionOverrideUpsertInput = z.infer<
  typeof kitCompositionOverrideUpsertSchema
>;
