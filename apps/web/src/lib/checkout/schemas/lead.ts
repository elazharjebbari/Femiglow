/**
 * Zod schemas — endpoints `/api/checkout/lead/*` (CHA-230).
 *
 * Cycle de vie d'un `chat_lead` côté wizard :
 *   1. POST `/api/checkout/lead`               — create (step 1)
 *   2. PATCH `/api/checkout/lead/[id]/address` — adresse (step 2)
 *   3. PATCH `/api/checkout/lead/[id]/payment` — préférence paiement (step 3)
 *   4. POST `/api/checkout/order`              — finalisation (lead → order)
 *
 * Tous les endpoints respectent :
 *   - `Idempotency-Key` (cf. checkout_idempotency table)
 *   - Validation Zod stricte du body
 *   - Retour `{ leadId, status, … }` cohérent
 *
 * Le `consent` est obligatoire au create — on ne peut pas faire opt-out.
 */
import { z } from 'zod';

import {
  cartSnapshotSchema,
  emailSchema,
  formContextSchema,
  paymentMethodSchema,
  phoneMaroc9DigitsSchema,
  shippingModeSchema,
} from './common';

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — POST /api/checkout/lead — Create
// ─────────────────────────────────────────────────────────────────────────────

export const createLeadInputSchema = z.object({
  formContext: formContextSchema,
  /** Prénom (champ 1 du step). */
  firstName: z.string().trim().min(2, 'Prénom requis (au moins 2 caractères).').max(60),
  /** Téléphone Maroc, 9 chiffres après +212. */
  phone: phoneMaroc9DigitsSchema,
  /**
   * Snapshot du panier au moment de la capture. Permet le retracking
   * (relance commerciale, debug post-mortem) même si l'utilisateur
   * abandonne ensuite.
   */
  cartSnapshot: cartSnapshotSchema.optional(),
  /**
   * Consent (obligatoire). Le champ doit être strictement `true` — on
   * refuse les valeurs falsy pour forcer l'opt-in explicite UI.
   */
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consentement RGPD requis.' }),
  }),
  /**
   * Version de la politique de consentement affichée à l'utilisateur,
   * stockée pour audit. Ex. `2025-11-01`.
   */
  consentVersion: z.string().min(1).max(40),
  /** Visitor ID (cookie analytics). */
  visitorId: z.string().min(8).max(120),
  /** Session ID (cookie chat). */
  sessionId: z.string().min(8).max(120),
  /** Langue détectée. */
  language: z.enum(['fr', 'ar', 'ar-MA']),
  /** Page d'origine (pathname). */
  page: z.string().max(500).optional(),
  /** Referrer. */
  referrer: z.string().max(500).optional(),
  /** Tracking UTM (jsonb). */
  utm: z.record(z.string(), z.string()).optional(),
  /** Ad attribution (Google / Meta). */
  gclid: z.string().max(200).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(200).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadInputSchema>;

export const createLeadResponseSchema = z.object({
  leadId: z.string(),
  status: z.literal('created'),
  /** Étape suivante recommandée par le serveur. */
  nextStep: z.literal('address'),
});
export type CreateLeadResponse = z.infer<typeof createLeadResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — PATCH /api/checkout/lead/[leadId]/address
// ─────────────────────────────────────────────────────────────────────────────

export const patchLeadAddressInputSchema = z.object({
  city: z.string().trim().min(2, 'Ville requise.').max(80),
  /**
   * CHA-233 — Adresse libre optionnelle.
   * Mode B (panier) ne l'exige pas (city seule suffit pour livraison Maroc).
   * Le wizard /kit garde son `min(4)` côté UI, mais le serveur tolère vide.
   */
  addressLine1: z.string().trim().max(160).optional().or(z.literal('')),
  addressLine2: z.string().trim().max(160).optional(),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine(
      (val) => !val || /^[0-9]{4,8}$/u.test(val),
      'Code postal invalide (4 à 8 chiffres).',
    ),
  country: z.string().length(2, 'Code pays sur 2 caractères (ex. MA).').default('MA'),
  notes: z.string().trim().max(500).optional(),
  shippingMode: shippingModeSchema.default('standard'),
});
export type PatchLeadAddressInput = z.infer<typeof patchLeadAddressInputSchema>;

/**
 * CHA-231 : `nextStep` accepte `payment` (legacy) ou `thank_you` (wizard v3).
 * Le serveur peut router selon la config du form ; on garde la flexibilité.
 */
export const patchLeadAddressResponseSchema = z.object({
  leadId: z.string(),
  status: z.literal('address_completed'),
  nextStep: z.enum(['payment', 'thank_you']),
});
export type PatchLeadAddressResponse = z.infer<typeof patchLeadAddressResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — PATCH /api/checkout/lead/[leadId]/payment
// ─────────────────────────────────────────────────────────────────────────────

export const patchLeadPaymentInputSchema = z.object({
  paymentMethod: paymentMethodSchema,
});
export type PatchLeadPaymentInput = z.infer<typeof patchLeadPaymentInputSchema>;

export const patchLeadPaymentResponseSchema = z.object({
  leadId: z.string(),
  status: z.literal('payment_selected'),
  nextStep: z.literal('thank_you'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — PATCH /api/checkout/order/[orderId]/email — Opt-in email
// ─────────────────────────────────────────────────────────────────────────────

export const optInEmailInputSchema = z.object({
  email: emailSchema,
  /** Consent marketing — obligatoire pour cocher l'opt-in. */
  emailConsent: z.literal(true, {
    errorMap: () => ({ message: 'Acceptation requise.' }),
  }),
});
export type OptInEmailInput = z.infer<typeof optInEmailInputSchema>;

export const optInEmailResponseSchema = z.object({
  orderId: z.string(),
  email: emailSchema,
  status: z.literal('email_optin_saved'),
});
export type OptInEmailResponse = z.infer<typeof optInEmailResponseSchema>;
