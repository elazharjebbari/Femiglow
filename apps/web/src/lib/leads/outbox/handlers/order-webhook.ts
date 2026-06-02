/**
 * OWBS — Handler d'effet `order_webhook` (adapter vers le webhook sortant
 * existant `dispatchOrderWebhook`).
 *
 * Le worker (P2) invoque ce handler de façon **durable** (survit à un restart),
 * en remplacement du `void dispatchOrderWebhook(...)` fire-and-forget inline.
 * Le lead est re-fetché par `leadId` (payload compact, PII minimale dans l'outbox).
 * Si `dispatchOrderWebhook` lève, l'outbox re-planifie (backoff) ; s'il renvoie
 * un statut (sent/skipped), c'est traité comme `done`.
 *
 * @see docs/checkout-leads-background-2026-06-01 (P5)
 */
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { dispatchOrderWebhook } from '@/lib/webhooks/outbound/sources/from-order';
import type { LeadEffectHandler } from '../handlers';

export interface OrderWebhookEffectPayload {
  orderId: string;
  totalCents: number;
  currency: string;
  items: Array<{ sku: string; name: string; quantity: number; variantKey: string | null }>;
  shippingMode?: 'standard' | 'express' | 'pickup';
  paymentMethod?: 'cod' | 'bank_transfer' | 'card';
  ip?: string | null;
}

export const orderWebhookHandler: LeadEffectHandler = async (row) => {
  const p = row.payload as unknown as OrderWebhookEffectPayload;
  const lead = await wizardLeadRepo.getById(row.leadId);
  if (!lead) {
    throw new Error(`order_webhook: lead ${row.leadId} introuvable`);
  }
  await dispatchOrderWebhook({
    order: { id: p.orderId, totalCents: p.totalCents, currency: p.currency },
    items: p.items,
    lead,
    shippingMode: p.shippingMode,
    paymentMethod: p.paymentMethod,
    ip: p.ip ?? null,
  });
};
