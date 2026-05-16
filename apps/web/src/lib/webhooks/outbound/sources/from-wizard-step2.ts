import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';
import type { WebhookDelivery, WebhookEventName } from '@/lib/db/types';
import { logger } from '@/lib/logging/logger';
import { attemptDelivery, enqueueDelivery } from '@/lib/webhooks/engine';

import { dispatchOutbound, resolveWebhookEndpoint, type DispatchResult } from '../dispatcher';
import { snapshotMessagesToConversation } from '../helpers/conversation';
import {
  composeFullName,
  normalizePhoneForPayload,
  validateOutboundPayload,
  type OutboundPayload,
} from '../payload';
import { getLeadWebhookSettings } from '../settings';

const COUNTRY_LABEL: Record<string, string> = {
  MA: 'Maroc',
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  DZ: 'Algérie',
  TN: 'Tunisie',
};

export interface LeadStep2WebhookResult {
  status: DispatchResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

type Step2DispatchResult = LeadStep2WebhookResult & {
  sentPayload?: OutboundPayload;
};

function composeAddress(line1: string | null, line2: string | null): string | undefined {
  const a = (line1 ?? '').trim();
  const b = (line2 ?? '').trim();
  if (!a && !b) return undefined;
  if (!b) return a;
  if (!a) return b;
  return `${a}, ${b}`;
}

function productFields(lead: ChatLeadRow): {
  productName?: string;
  productSku?: string;
  quantity: number;
  totalPrice?: number;
  currency: string;
} {
  const snap = lead.cartSnapshot;
  const items = snap?.items ?? [];
  return {
    productName:
      items.length === 1
        ? items[0]?.name
        : items.length > 1
          ? items.map((item) => item.name).join(' + ')
          : undefined,
    productSku:
      items.length === 1
        ? items[0]?.sku
        : items.length > 1
          ? items.map((item) => item.sku).join(', ')
          : undefined,
    quantity: Math.max(1, items.reduce((acc, item) => acc + (item.quantity ?? 0), 0)),
    totalPrice: typeof snap?.totalCents === 'number' ? Math.round(snap.totalCents) / 100 : undefined,
    currency: (snap?.currency ?? lead.cartCurrency ?? 'MAD').toUpperCase(),
  };
}

function buildStep2Payload(
  lead: ChatLeadRow,
  options: { ip?: string | null },
  conversationSettings: {
    enabled: boolean;
    maxMessages: number;
    maxBytes: number;
  },
  phone: string,
): OutboundPayload {
  const products = productFields(lead);
  const countryCode = (lead.shippingCountry ?? 'MA').toUpperCase();
  return validateOutboundPayload({
    id: `lead-step2:${lead.id}`,
    full_name: composeFullName(lead.firstName, lead.lastName),
    phone,
    source: lead.source ?? 'wizard_kit',
    conversation: conversationSettings.enabled
      ? snapshotMessagesToConversation(lead.snapshotMessages, {
          userName: lead.firstName,
          maxMessages: conversationSettings.maxMessages,
          maxBytes: conversationSettings.maxBytes,
        })
      : undefined,
    address: composeAddress(lead.shippingAddressLine1, lead.shippingAddressLine2),
    city: lead.shippingCity ?? undefined,
    country: COUNTRY_LABEL[countryCode] ?? countryCode,
    email: lead.email ?? undefined,
    total_price: products.totalPrice,
    currency: products.currency,
    quantity: products.quantity,
    product_name: products.productName,
    product_sku: products.productSku,
    note: lead.shippingNotes ?? undefined,
    source_channel: lead.formId ?? lead.formMode ?? lead.source ?? 'wizard',
    ip: options.ip ?? undefined,
  });
}

function matchingStep2Event(events: WebhookEventName[]): WebhookEventName | null {
  if (events.includes('lead.step2_completed')) return 'lead.step2_completed';
  // Compatibilité avec les endpoints existants créés avant l'event dédié.
  if (events.includes('lead.created')) return 'lead.created';
  return null;
}

function resultFromAdminDeliveries(results: WebhookDelivery[]): Step2DispatchResult {
  const succeeded = results.find((delivery) => delivery.status === 'succeeded');
  if (succeeded) {
    return {
      status: 'sent',
      attempts: succeeded.attemptCount,
      responseStatus: succeeded.responseStatus ?? undefined,
      logId: succeeded.id,
    };
  }

  const retryable = results.find((delivery) => delivery.status === 'pending');
  if (retryable) {
    return {
      status: 'pending',
      attempts: retryable.attemptCount,
      responseStatus: retryable.responseStatus ?? undefined,
      logId: retryable.id,
      lastError: retryable.errorCode ?? retryable.responseBody ?? 'delivery-pending-retry',
    };
  }

  const failed = results.find(
    (delivery) => delivery.status === 'failed' || delivery.status === 'permanent',
  );
  return {
    status: 'failed',
    attempts: failed?.attemptCount ?? 0,
    responseStatus: failed?.responseStatus ?? undefined,
    logId: failed?.id,
    lastError: failed?.errorCode ?? failed?.responseBody ?? 'admin-endpoint-delivery-failed',
  };
}

async function dispatchStep2ToAdminEndpoints(
  lead: ChatLeadRow,
  payload: OutboundPayload,
): Promise<Step2DispatchResult | null> {
  const endpoints = await listWebhookEndpoints();
  const matching = endpoints
    .filter((endpoint) => endpoint.active)
    .map((endpoint) => ({ endpoint, event: matchingStep2Event(endpoint.events) }))
    .filter(
      (entry): entry is { endpoint: (typeof endpoints)[number]; event: WebhookEventName } =>
        entry.event !== null,
    );

  if (matching.length === 0) return null;

  const attempted: WebhookDelivery[] = [];
  for (const { endpoint, event } of matching) {
    try {
      const delivery = await enqueueDelivery({
        endpointId: endpoint.id,
        event,
        idempotencyKey: `${event}:lead-step2:${lead.id}`,
        payload: {
          ...payload,
          event_name: 'lead.step2_completed',
          webhook_source: 'lead-step2',
          source_id: lead.id,
        },
      });
      attempted.push(await attemptDelivery(delivery));
    } catch (err) {
      logger.warn('outbound.webhook.lead-step2.admin_endpoint_failed', {
        endpointId: endpoint.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (attempted.length === 0) {
    return {
      status: 'failed',
      attempts: 0,
      lastError: 'admin-endpoint-dispatch-failed',
    };
  }

  return resultFromAdminDeliveries(attempted);
}

async function dispatchStep2(
  lead: ChatLeadRow,
  payload: OutboundPayload,
): Promise<Step2DispatchResult> {
  const adminResult = await dispatchStep2ToAdminEndpoints(lead, payload);
  if (adminResult) return { ...adminResult, sentPayload: payload };

  if (!resolveWebhookEndpoint()) {
    return {
      status: 'disabled',
      attempts: 0,
      lastError: 'no-endpoint-configured',
      sentPayload: payload,
    };
  }

  const outboundResult = await dispatchOutbound({
    source: 'lead-step2',
    sourceId: lead.id,
    idempotencyKey: `lead-step2:${lead.id}`,
    eventName: 'lead.step2_completed',
    payload,
  });
  return {
    status: outboundResult.status,
    attempts: outboundResult.attempts,
    responseStatus: outboundResult.responseStatus,
    logId: outboundResult.logId,
    lastError: outboundResult.lastError,
    sentPayload: outboundResult.sentPayload,
  };
}

export async function dispatchLeadStep2Webhook(
  lead: ChatLeadRow,
  options: { ip?: string | null } = {},
): Promise<LeadStep2WebhookResult> {
  if (lead.step2WebhookAt) {
    return { status: 'skipped', attempts: 0, lastError: 'step2-webhook-already-stamped' };
  }
  if (!lead.addressCompletedAt) {
    return { status: 'skipped', attempts: 0, lastError: 'address-not-completed' };
  }

  const phone = normalizePhoneForPayload(lead.phoneE164 || lead.phoneRaw, 'MA');
  if (!phone.ok) {
    return { status: 'skipped', attempts: 0, lastError: `invalid-phone:${phone.reason}` };
  }

  const settings = await getLeadWebhookSettings();
  if (!settings.step2WebhookEnabled) {
    return { status: 'disabled', attempts: 0, lastError: 'lead-step2-webhook-disabled' };
  }

  const payload = buildStep2Payload(lead, options, {
    enabled: settings.conversationEnabled,
    maxMessages: settings.conversationMaxMessages,
    maxBytes: settings.conversationMaxBytes,
  }, phone.value);
  const result = await dispatchStep2(lead, payload);

  logger.info('outbound.webhook.lead-step2.dispatch_result', {
    leadId: lead.id,
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
  });

  if (result.status === 'sent') {
    try {
      await wizardLeadRepo.stampStep2Webhook(lead.id);
    } catch (err) {
      logger.error('outbound.webhook.lead-step2.stamp_error', {
        leadId: lead.id,
        error: String(err),
      });
    }
  }

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}
