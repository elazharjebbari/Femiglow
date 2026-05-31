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

export const patchAdminStockInputSchema = z.object({
  variantId: z.string().min(8).max(120),
  /**
   * Action :
   *   - `set`       : remplace `available` par la valeur fournie
   *   - `increment` : ajoute la valeur (peut être négative)
   *   - `set_threshold` : modifie threshold_low
   */
  action: z.enum(['set', 'increment', 'set_threshold']),
  value: z.number().int(),
  /** Note d'audit. */
  note: z.string().trim().max(500).optional(),
});
export type PatchAdminStockInput = z.infer<typeof patchAdminStockInputSchema>;

export const patchAdminStockResponseSchema = z.object({
  variantId: z.string(),
  available: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  thresholdLow: z.number().int().nonnegative(),
});
export type PatchAdminStockResponse = z.infer<typeof patchAdminStockResponseSchema>;
