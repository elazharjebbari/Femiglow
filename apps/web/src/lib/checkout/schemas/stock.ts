/**
 * Zod schemas — endpoints stock (CHA-230).
 *
 *   - GET  `/api/checkout/stock/[variantId]`    — lecture publique
 *   - POST `/api/checkout/stock-notify`         — opt-in back-in-stock
 *   - PATCH `/api/admin/products/stock`         — mutation admin
 */
import { z } from 'zod';

import { emailSchema, phoneMaroc9DigitsSchema } from './common';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/checkout/stock/[variantId]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Statut affichable côté UI :
 *   - `in_stock`   : available - reserved > threshold_low — pas d'indicateur
 *   - `low_stock`  : 0 < available - reserved <= threshold_low — "derniers exemplaires"
 *   - `out_of_stock` : available - reserved <= 0 — bouton désactivé
 */
export const stockStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock']);
export type StockStatus = z.infer<typeof stockStatusSchema>;

export const getStockResponseSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  status: stockStatusSchema,
  /**
   * Effective = available - reserved. Volontairement borné pour ne pas
   * exposer le stock total exact (concurrence). On expose seulement
   * 0 (out) / 1..thresholdLow (low) / -1 (in stock, valeur masquée).
   */
  effectiveDisplay: z.number().int(),
  thresholdLow: z.number().int().nonnegative(),
});
export type GetStockResponse = z.infer<typeof getStockResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/checkout/stock-notify — opt-in back-in-stock
// ─────────────────────────────────────────────────────────────────────────────

export const stockNotifyInputSchema = z
  .object({
    variantId: z.string().min(8).max(120),
    email: emailSchema.optional(),
    phone: phoneMaroc9DigitsSchema.optional(),
    visitorId: z.string().min(8).max(120),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Consentement requis pour notification.' }),
    }),
  })
  .refine((d) => d.email || d.phone, {
    message: 'Email ou téléphone requis.',
    path: ['email'],
  });
export type StockNotifyInput = z.infer<typeof stockNotifyInputSchema>;

export const stockNotifyResponseSchema = z.object({
  status: z.literal('subscribed'),
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/products/stock — mutation admin
// ─────────────────────────────────────────────────────────────────────────────

const patchBase = {
  variantId: z.string().min(8).max(120),
  /** Note portée à l'historique. */
  note: z.string().trim().max(500).optional(),
  /** Identifiant de la saisie : un double envoi n'est appliqué qu'une fois. */
  idempotencyKey: z.string().min(8).max(120).optional(),
};

/** Plafond de saisie : au-delà, la colonne `integer` ferait échouer l'écriture. */
const MAX_STOCK_VALUE = 1_000_000;

export const patchAdminStockInputSchema = z.discriminatedUnion('action', [
  /** Réception : ajoute à la valeur en base, jamais à celle de l'écran. */
  z.object({
    ...patchBase,
    action: z.literal('restock'),
    value: z.number().int().positive().max(MAX_STOCK_VALUE),
  }),
  /**
   * Inventaire : remplace le compteur. `expectedAvailable` est la valeur vue à
   * l'écran : si une commande est passée entre-temps, la saisie est refusée.
   */
  z.object({
    ...patchBase,
    action: z.literal('count'),
    value: z.number().int().nonnegative().max(MAX_STOCK_VALUE),
    expectedAvailable: z.number().int(),
  }),
  z.object({
    ...patchBase,
    action: z.literal('set_threshold'),
    value: z.number().int().nonnegative().max(MAX_STOCK_VALUE),
  }),
  z.object({
    ...patchBase,
    action: z.literal('set_sell_when_out'),
    value: z.boolean(),
  }),
]);
export type PatchAdminStockInput = z.infer<typeof patchAdminStockInputSchema>;

export const patchAdminStockResponseSchema = z.object({
  variantId: z.string(),
  available: z.number().int(),
  reserved: z.number().int().nonnegative(),
  thresholdLow: z.number().int().nonnegative(),
  sellWhenOut: z.boolean(),
  /** Vrai si cette saisie avait déjà été appliquée (double envoi). */
  replayed: z.boolean(),
});
export type PatchAdminStockResponse = z.infer<typeof patchAdminStockResponseSchema>;
