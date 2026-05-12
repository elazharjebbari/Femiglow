import { z } from 'zod';
import { emailSchema } from './common';

export const phoneMaroc9DigitsSchema = z
  .string()
  .regex(
    /^[5-7]\d{8}$/u,
    'Numéro à 9 chiffres après le préfixe +212.',
  );

/**
 * CHA-233 — Mode B aligné sur le wizard /kit.
 * Step 1 ne demande plus que prénom + téléphone (mirror de `LeadCaptureStep`).
 * L'email passe au step 3 en opt-in (champ top-level `recapEmail`).
 * Les checkboxes newsletter / créer-un-compte sont retirées.
 */
export const checkoutContactSchema = z.object({
  firstName: z.string().min(2, 'Au moins 2 caractères.').max(60),
  phone: phoneMaroc9DigitsSchema,
});
export type CheckoutContact = z.infer<typeof checkoutContactSchema>;

/**
 * Liste héritée des slugs villes "historiques" pré-CHA-230. Conservée car
 * utilisée pour le formatage du recap, certains tests, et le scoring Express
 * (Casablanca). N'est PLUS l'autorité du schéma — l'autocomplete DB-driven
 * (`<CityAutocomplete>`) permet n'importe quel nom de ville saisi librement.
 */
export const villeMarocEnum = z.enum([
  'casablanca',
  'rabat',
  'marrakech',
  'fes',
  'tanger',
  'agadir',
  'meknes',
  'oujda',
  'tetouan',
  'sale',
  'autre',
]);
export type VilleMaroc = z.infer<typeof villeMarocEnum>;

export const shippingModeSchema = z.enum(['standard', 'express']);
export type ShippingMode = z.infer<typeof shippingModeSchema>;

/**
 * CHA-233 — Mode B simplifié.
 *
 * Aligné sur le wizard : ville libre (autocomplete) + adresse libre **optionnelle**
 * + notes pour le coursier. Plus de line2, quartier, postalCode, shippingMode :
 *   - line2 / quartier : redondants — le combobox + adresse libre suffisent.
 *   - postalCode : non utilisé pour le routing au Maroc (livraison main propre).
 *   - shippingMode : mode unique forcé "standard" côté serveur (cf. CHA-231).
 *
 * Les champs legacy (`line2`, `quartier`, `postalCode`, `cityOther`,
 * `shippingMode`) sont acceptés en lecture mais ignorés — c'est de la backward-
 * compat pour les drafts localStorage pré-CHA-233.
 */
export const checkoutAddressSchema = z
  .object({
    city: z.string().trim().min(2, 'Indiquez votre ville.').max(80, 'Nom de ville trop long.'),
    line1: z
      .string()
      .trim()
      .max(160, 'Adresse trop longue.')
      .optional()
      .or(z.literal('')),
    notes: z.string().trim().max(500, 'Note trop longue (max 500 caractères).').optional(),
    country: z.literal('MA'),
    // ── Legacy fields (acceptés silencieusement, ignorés côté business) ────
    line2: z.string().max(120).optional(),
    quartier: z.string().max(80).optional(),
    cityOther: z.string().max(60).optional(),
    postalCode: z
      .string()
      .regex(/^[0-9]{5}$/u, 'Code postal à 5 chiffres.')
      .optional()
      .or(z.literal('')),
    shippingMode: shippingModeSchema.optional(),
  })
  .passthrough();
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

export const checkoutPaymentMethodSchema = z.enum(['card', 'cmi', 'cod']);
export type CheckoutPaymentMethod = z.infer<typeof checkoutPaymentMethodSchema>;

/**
 * CHA-233 — Email opt-in pour récap de commande (step 3, équivalent du
 * `ThankYouStep` opt-in côté wizard mais saisi AVANT confirmation).
 *
 * Accepte également la chaîne vide pour faciliter le formulaire RHF (un input
 * `type="email"` vide produit `""`, pas `undefined`).
 */
const recapEmailSchema = z.union([emailSchema, z.literal('')]).optional();

export const checkoutFormSchema = z.object({
  contact: checkoutContactSchema,
  address: checkoutAddressSchema,
  paymentMethod: checkoutPaymentMethodSchema,
  promoCode: z.string().max(40).optional(),
  recapEmail: recapEmailSchema,
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Acceptation requise.' }),
  }),
});
export type CheckoutForm = z.infer<typeof checkoutFormSchema>;

export const orderIdSchema = z
  .string()
  .regex(/^FG-\d{4}-[A-Z0-9]{5}$/u, 'Format de commande invalide.');
