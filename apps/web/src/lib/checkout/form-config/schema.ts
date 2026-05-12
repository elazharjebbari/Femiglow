/**
 * Schema Zod validant le JSONB `form_config.config` (CHA-230).
 *
 * Source de vérité pour le contenu du JSONB. Toute mutation passe par ce
 * schema (côté admin UI + côté API).
 *
 * Le schema est volontairement strict : les champs inconnus sont rejetés
 * (`strict()`) pour éviter qu'une migration de config silencieuse passe
 * inaperçue. Les nouveaux champs doivent être explicitement ajoutés ici.
 */
import { z } from 'zod';

import {
  formModeSchema,
  paymentMethodSchema,
  shippingModeSchema,
  stepNameSchema,
} from '@/lib/checkout/schemas/common';

// ─────────────────────────────────────────────────────────────────────────────
// Sous-schemas
// ─────────────────────────────────────────────────────────────────────────────

export const formConfigDefaultsSchema = z
  .object({
    formMode: formModeSchema,
    currency: z.string().length(3).default('MAD'),
    country: z.string().length(2).default('MA'),
    paymentMethods: z.array(paymentMethodSchema).min(1).max(3),
    defaultShippingMode: shippingModeSchema.default('standard'),
  })
  .strict();
export type FormConfigDefaults = z.infer<typeof formConfigDefaultsSchema>;

export const formConfigCopySchema = z
  .object({
    title: z.string().min(1).max(200),
    cta_cart: z.string().max(80).optional(),
    cta_lead: z.string().min(1).max(80),
    cta_address: z.string().min(1).max(80),
    cta_payment: z.string().min(1).max(80),
    thank_you_title: z.string().min(1).max(200),
    thank_you_subtitle: z.string().max(300).optional(),
  })
  .strict();
export type FormConfigCopy = z.infer<typeof formConfigCopySchema>;

export const formConfigValidationSchema = z
  .object({
    phone_min_length: z.number().int().min(5).max(15).default(9),
    phone_max_length: z.number().int().min(5).max(15).default(13),
    require_email_on_thank_you: z.boolean().default(false),
    require_postal_code: z.boolean().default(false),
  })
  .strict();
export type FormConfigValidation = z.infer<typeof formConfigValidationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Root schema
// ─────────────────────────────────────────────────────────────────────────────

/** Etapes minimum communes à tous les wizards. */
const REQUIRED_STEPS = ['lead', 'address', 'payment', 'thank_you'] as const;

export const formConfigJsonSchema = z
  .object({
    /**
     * Ordre des steps affichés. Doit contenir au moins
     * `lead/address/payment/thank_you`. Mode B peut ajouter `cart_review`
     * en tête.
     */
    steps: z
      .array(stepNameSchema)
      .min(REQUIRED_STEPS.length)
      .max(5)
      .refine(
        (steps) => REQUIRED_STEPS.every((req) => steps.includes(req)),
        `Les steps suivants sont requis : ${REQUIRED_STEPS.join(', ')}.`,
      ),
    modes: z.array(formModeSchema).min(1).max(3),
    defaults: formConfigDefaultsSchema,
    copy: formConfigCopySchema,
    validation: formConfigValidationSchema,
  })
  .strict();
export type FormConfigJson = z.infer<typeof formConfigJsonSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de requête API (PATCH /api/admin/form-config/[key])
// ─────────────────────────────────────────────────────────────────────────────

export const patchFormConfigInputSchema = z.object({
  /** Update complet de la config (versionnage côté serveur). */
  config: formConfigJsonSchema,
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
});
export type PatchFormConfigInput = z.infer<typeof patchFormConfigInputSchema>;
