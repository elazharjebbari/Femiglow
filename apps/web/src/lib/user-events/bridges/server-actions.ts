/**
 * Bridge server actions → user_event (M5.2.4).
 *
 * Helpers à appeler depuis les API routes / server actions après une
 * mutation user-impactante. Fire-and-forget, ne bloque jamais le flow
 * principal.
 *
 * Convention event_name :
 *   lead.created       — nouveau lead (formulaire contact, chat, etc.)
 *   lead.updated       — modif depuis admin
 *   order.placed       — création commande
 *   order.cancelled    — annulation
 *   order.delivered    — livraison confirmée
 *   newsletter.subscribed — inscription form (M5.2.3 le fait déjà via webhook Listmonk)
 *   contact.submitted  — soumission formulaire contact
 *   cart.abandoned     — détecté par cart-abandon-scanner
 */
import 'server-only';
import { insertUserEventSafe } from '../insert';

export type ServerEventInput = {
  email: string;
  eventName: string;
  properties?: Record<string, unknown>;
  leadId?: string | null;
  ts?: Date;
};

/**
 * Record un event serveur. Fire-and-forget — toujours résoudre sans throw.
 */
export async function recordServerEvent(input: ServerEventInput): Promise<boolean> {
  if (!input.email || !input.eventName) return false;
  const result = await insertUserEventSafe({
    email: input.email,
    eventName: input.eventName,
    source: 'server',
    properties: input.properties,
    leadId: input.leadId ?? undefined,
    ts: input.ts,
  });
  return result !== null;
}

// ── Helpers spécialisés (sucre syntaxique typé) ─────────────────────────

export async function recordLeadCreated(input: {
  email: string;
  leadId?: string;
  source?: string;
  formType?: string;
}): Promise<boolean> {
  return recordServerEvent({
    email: input.email,
    eventName: 'lead.created',
    leadId: input.leadId,
    properties: {
      source: input.source,
      formType: input.formType,
    },
  });
}

export async function recordOrderPlaced(input: {
  email: string;
  orderId: string;
  totalCents: number;
  currency: string;
  itemsCount: number;
  leadId?: string;
}): Promise<boolean> {
  return recordServerEvent({
    email: input.email,
    eventName: 'order.placed',
    leadId: input.leadId,
    properties: {
      orderId: input.orderId,
      totalCents: input.totalCents,
      currency: input.currency,
      itemsCount: input.itemsCount,
    },
  });
}

export async function recordContactSubmitted(input: {
  email: string;
  contactType: 'question' | 'order' | 'professional';
  hasPhone: boolean;
}): Promise<boolean> {
  return recordServerEvent({
    email: input.email,
    eventName: 'contact.submitted',
    properties: {
      contactType: input.contactType,
      hasPhone: input.hasPhone,
    },
  });
}
