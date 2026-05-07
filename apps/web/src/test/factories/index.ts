/**
 * Factories de test FemiGlow.
 * Fournissent des entités cohérentes (Lead, Order, Webhook, Delivery, Admin)
 * avec valeurs par défaut surchargées par `overrides`.
 */
import { createId } from '@/lib/ids';
import type {
  AdminUser,
  Lead,
  LeadEvent,
  LeadStatus,
  Order,
  OrderItem,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventName,
} from '@/lib/db/types';

export function buildAdmin(overrides: Partial<AdminUser> = {}): AdminUser {
  const now = new Date();
  return {
    id: createId('u'),
    email: 'fondatrice@femiglow.ma',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$placeholder',
    name: 'Fondatrice',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date();
  return {
    id: createId('l'),
    email: 'cliente@example.com',
    phone: '+212600000000',
    name: 'Cliente Test',
    status: 'new',
    source: 'rituel-page',
    consentMarketing: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildLeadEvent(overrides: Partial<LeadEvent> = {}): LeadEvent {
  return {
    id: createId('le'),
    leadId: overrides.leadId ?? createId('l'),
    type: 'created',
    actorId: null,
    payload: {},
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: createId('o'),
    leadId: overrides.leadId ?? createId('l'),
    totalCents: 49000,
    currency: 'MAD',
    shippingMode: 'home',
    paymentMethod: 'cod',
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: createId('oi'),
    orderId: overrides.orderId ?? createId('o'),
    sku: 'kit-fondateur',
    name: 'Kit fondateur',
    quantity: 1,
    unitPriceCents: 49000,
    ...overrides,
  };
}

export function buildWebhook(overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  const now = new Date();
  return {
    id: createId('we'),
    url: 'https://webhook.example.com/femiglow',
    events: ['lead.created', 'order.created'] satisfies WebhookEventName[],
    encryptedSecret: 'enc::placeholder::iv::tag',
    active: true,
    description: 'Test endpoint',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

export function buildDelivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  const now = new Date();
  return {
    id: createId('wd'),
    endpointId: overrides.endpointId ?? createId('we'),
    event: 'lead.created',
    payload: { leadId: createId('l') },
    idempotencyKey: createId('idk'),
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: now,
    responseStatus: null,
    responseBody: null,
    errorCode: null,
    latencyMs: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export const STATUSES_LIFECYCLE: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
  'archived',
];
