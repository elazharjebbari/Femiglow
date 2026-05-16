import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { logger } from '@/lib/logging/logger';

import { dispatchOutbound, type DispatchResult } from '../dispatcher';
import { snapshotMessagesToConversation } from '../helpers/conversation';
import { composeFullName, normalizePhoneForPayload } from '../payload';
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

  const products = productFields(lead);
  const countryCode = (lead.shippingCountry ?? 'MA').toUpperCase();
  const result = await dispatchOutbound({
    source: 'lead-step2',
    sourceId: lead.id,
    idempotencyKey: `lead-step2:${lead.id}`,
    eventName: 'lead.step2_completed',
    payload: {
      id: `lead-step2:${lead.id}`,
      full_name: composeFullName(lead.firstName, lead.lastName),
      phone: phone.value,
      source: lead.source ?? 'wizard_kit',
      conversation: settings.conversationEnabled
        ? snapshotMessagesToConversation(lead.snapshotMessages, {
            userName: lead.firstName,
            maxMessages: settings.conversationMaxMessages,
            maxBytes: settings.conversationMaxBytes,
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
    },
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
