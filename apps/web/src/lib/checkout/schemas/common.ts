/**
 * Schemas Zod transverses au wizard checkout (CHA-230).
 *
 * Source de vérité unique des contraintes — partagée entre l'UI et les
 * route handlers. Toutes les chaînes énumérées sont alignées avec :
 *   - les CHECK constraints SQL (cf. drizzle/migrations/0016+0017)
 *   - la taxonomie tracking (cf. lib/tracking/checkout-events.ts)
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Énumérations partagées
// ─────────────────────────────────────────────────────────────────────────────

export const formModeSchema = z.enum(['wizard_embed', 'wizard_cart', 'legacy_cart']);
export type FormMode = z.infer<typeof formModeSchema>;

export const variantKeySchema = z.enum(['A', 'B', 'control']);
export type VariantKey = z.infer<typeof variantKeySchema>;

export const stepNameSchema = z.enum([
  'cart_review',
  'lead',
  'address',
  'payment',
  'thank_you',
]);
export type StepName = z.infer<typeof stepNameSchema>;

export const paymentMethodSchema = z.enum(['cod', 'bank_transfer', 'card']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const shippingModeSchema = z.enum(['standard', 'express', 'pickup']);
export type ShippingMode = z.infer<typeof shippingModeSchema>;

export const sourceSchema = z.enum([
  'chat_widget',
  'wizard_kit',
  'wizard_commander',
  'newsletter',
  'admin',
  'inline',
]);
export type Source = z.infer<typeof sourceSchema>;

/**
 * Langue de saisie / d'interface du wizard (CHA-231).
 *
 * Utilisée pour :
 *   - tracking : segmentation funnel FR vs AR
 *   - serveur : choix de la langue des emails de confirmation
 *   - client : application du dir RTL et du dictionnaire de copy
 *
 * Reste optionnel côté schéma de form_context pour rétro-compat.
 */
export const languageSchema = z.enum(['fr', 'ar']);
export type Language = z.infer<typeof languageSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Téléphone Maroc (E.164)
// ─────────────────────────────────────────────────────────────────────────────
// Format attendu : 9 chiffres après le préfixe +212, commençant par 5/6/7
// (mobile MA). Le format E.164 résultant est `+2125XXXXXXXX` (12 caractères).
// On accepte aussi un format raw plus permissif (formaté +212 6 12 34 56 78
// par l'UI), mais on normalise toujours côté serveur.

export const phoneMaroc9DigitsSchema = z
  .string()
  .regex(/^[5-7]\d{8}$/u, 'Numéro à 9 chiffres après le préfixe +212.');

export const phoneE164MarocSchema = z
  .string()
  .regex(/^\+212[5-7]\d{8}$/u, 'Format E.164 attendu (+212XXXXXXXXX).');

/** Normalise un input téléphone (raw avec espaces / +212 / 0) en E.164. */
export function normalizePhoneToE164Maroc(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/gu, '');
  if (/^\+212[5-7]\d{8}$/u.test(cleaned)) return cleaned;
  if (/^00212[5-7]\d{8}$/u.test(cleaned)) return `+${cleaned.slice(2)}`;
  if (/^0[5-7]\d{8}$/u.test(cleaned)) return `+212${cleaned.slice(1)}`;
  if (/^[5-7]\d{8}$/u.test(cleaned)) return `+212${cleaned}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email (RFC 5322 simplifié)
// ─────────────────────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email trop court.')
  .max(254, 'Email trop long.')
  .email('Adresse email invalide.');

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency key (UUID/ulid lib côté client)
// ─────────────────────────────────────────────────────────────────────────────

export const idempotencyKeySchema = z
  .string()
  .min(8, 'Clé d\'idempotence trop courte.')
  .max(128, 'Clé d\'idempotence trop longue.')
  .regex(/^[a-zA-Z0-9_-]+$/u, 'Clé d\'idempotence invalide.');

// ─────────────────────────────────────────────────────────────────────────────
// Cart item snapshot (côté serveur on revalide les prix)
// ─────────────────────────────────────────────────────────────────────────────

export const cartItemSnapshotSchema = z.object({
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(99),
  unitPriceCents: z.number().int().nonnegative(),
  /**
   * Identifiant du `product_variant` (ex. `pvar_...`). Optionnel pour
   * rétrocompatibilité (les anciennes routes `/api/cart` ne le projetaient
   * pas), mais REQUIS pour brancher le StockIndicator et la réservation
   * atomique à la création de l'order. À terme la projection serveur
   * doit toujours l'inclure.
   */
  variantId: z.string().min(8).max(120).optional(),
});
export type CartItemSnapshot = z.infer<typeof cartItemSnapshotSchema>;

export const cartSnapshotSchema = z.object({
  items: z.array(cartItemSnapshotSchema).min(1, 'Panier vide.').max(20),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3, 'Devise sur 3 caractères (ex. MAD).'),
});
export type CartSnapshot = z.infer<typeof cartSnapshotSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form context (transverse à tous les events / patches)
// ─────────────────────────────────────────────────────────────────────────────

export const formContextSchema = z.object({
  formId: z.string().min(1).max(80),
  formMode: formModeSchema,
  variantKey: variantKeySchema.nullable().optional(),
  source: sourceSchema.optional(),
  /**
   * CHA-231 — Langue de saisie courante du wizard. Optionnel pour rétro-compat
   * (les payloads existants par défaut sont considérés `fr`).
   */
  language: languageSchema.optional(),
});
export type FormContext = z.infer<typeof formContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de réponse erreur (cohérents sur tous les endpoints)
// ─────────────────────────────────────────────────────────────────────────────

export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  field: z.string().optional(),
  issues: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
