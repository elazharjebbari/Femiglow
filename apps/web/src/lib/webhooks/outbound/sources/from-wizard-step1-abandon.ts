import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';

export interface LeadStep1AbandonWebhookResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

export async function dispatchLeadStep1AbandonWebhook(
  lead: ChatLeadRow,
): Promise<LeadStep1AbandonWebhookResult> {
  const phone = normalizePhoneForPayload(lead.phoneE164 || lead.phoneRaw, 'MA');
  if (!phone.ok) {
    return { status: 'skipped', attempts: 0, lastError: `invalid-phone:${phone.reason}` };
  }

  const result = await dispatchToAllChannels({
    source: 'lead-step1-abandon',
    sourceId: lead.id,
    idempotencyKey: `lead-step1-abandon:${lead.id}`,
    eventName: 'lead.step1_abandoned',
    adminEventNames: ['lead.step1_abandoned'],
    payload: {
      id: `lead-step1-abandon:${lead.id}`,
      full_name: composeFullName(lead.firstName, lead.lastName),
      phone: phone.value,
      source: lead.source ?? 'wizard_kit',
      email: lead.email ?? undefined,
      currency: (lead.cartCurrency ?? lead.cartSnapshot?.currency ?? 'MAD').toUpperCase(),
      quantity: 1,
      note: ['step1-abandoned', lead.formId ? `form:${lead.formId}` : null]
        .filter(Boolean)
        .join(' | '),
      source_channel: lead.formId ?? lead.formMode ?? lead.source ?? 'wizard',
    },
  });

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}