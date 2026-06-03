/**
 * Zod schemas — endpoint `/api/checkout/order` (CHA-230).
 *
 * Création finale de l'order. Le serveur :
 *   1. Vérifie l'idempotence (Idempotency-Key)
 *   2. Récupère le chat_lead par ID (doit avoir `address_completed_at` et
 *      `payment_selected_at`)
 *   3. Re-valide les prix items vs DB (pas de manipulation client)
 *   4. Réserve le stock (atomic CAS) ou bloque
 *   5. Crée la row `orders` + `order_items` + lie le chat_lead
 *   6. Retourne l'orderId
 */
import { z } from 'zod';

import {
  cartItemSnapshotSchema,
  formContextSchema,
  paymentMethodSchema,
  shippingModeSchema,
} from './common';

export const createOrderInputSchema = z.object({
  leadId: z.string().min(8).max(120),
  formContext: formContextSchema,
  items: z.array(cartItemSnapshotSchema).min(1).max(20),
  /** Total attendu côté client (re-vérifié serveur). */
  expectedTotalCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('MAD'),
  paymentMethod: paymentMethodSchema,
  shippingMode: shippingModeSchema.default('standard'),
  /** Code de crédit fidélité (Phase 3), optionnel. */
  couponCode: z.string().trim().min(3).max(40).nullable().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const createOrderResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(['created', 'pending_confirmation']),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
