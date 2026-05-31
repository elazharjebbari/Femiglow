/**
 * Schemas Zod pour l'API admin `/admin/kit/pack`.
 *
 * Valident le PATCH (champ par champ, `null` = retour mock).
 */
import { z } from 'zod';

const valueItem = z.object({
  label: z.string().min(1).max(60),
  valueLabel: z.string().min(1).max(20),
  muted: z.boolean().optional(),
});

/**
 * Patch upsert — tous les champs sont optionnels. `null` explicite
 * signifie « retour au mock » pour ce champ.
 */
export const kitPackOverrideUpsertSchema = z
  .object({
    kicker: z.string().min(1).max(40).nullable().optional(),
    title: z.string().min(1).max(120).nullable().optional(),
    lead: z.string().min(1).max(400).nullable().optional(),
    pricePrefix: z.string().min(1).max(20).nullable().optional(),
    ctaLabel: z.string().min(1).max(40).nullable().optional(),
    ctaMicrocopy: z
      .string()
      .min(1)
      .max(400)
      .refine(
        (s) => s.split(/\s+/).filter(Boolean).length >= 8,
        'ctaMicrocopy doit contenir au moins 8 mots (Kolenda Pricing #11).',
      )
      .nullable()
      .optional(),
    priceCompareAt: z.string().min(1).max(20).nullable().optional(),
    priceCompareAtAriaLabel: z.string().min(1).max(80).nullable().optional(),
    valueBreakdown: z.array(valueItem).min(1).max(6).nullable().optional(),
    perUsageHint: z.string().min(1).max(80).nullable().optional(),
    ctaAccent: z
      .enum(['sauge-dark', 'champagne', 'terracotta'])
      .nullable()
      .optional(),
    countLabelGeo: z.string().min(1).max(80).nullable().optional(),
  })
  .strict();

export type KitPackOverrideUpsertInput = z.infer<typeof kitPackOverrideUpsertSchema>;
