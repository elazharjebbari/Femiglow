/**
 * Builder webhook outbound pour les leads inline-contact.
 *
 * Déclenché immédiatement quand un numéro de téléphone est détecté
 * dans le chat (orchestrator `detectInlineContact`). Payload similaire
 * à `from-chat-lead.ts` mais avec un idempotency-key distinct pour
 * permettre l'upgrade sans collision.
 *
 * Dispatch vers les endpoints admin EN PRIORITÉ, puis fallback outbound URL.
 *
 * Feature flag : `lead.inline_contact_webhook_enabled` (default true).
 */
import { eventRepo } from '@/lib/chat/repos/event';
import { leadRepo } from '@/lib/chat/repos/lead';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';
import { snapshotMessagesToConversation } from '../helpers/conversation';
import { getLeadWebhookSettings } from '../settings';

export interface InlineContactWebhookResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

export async function dispatchInlineContactWebhook(
  lead: ChatLeadRow,
): Promise<InlineContactWebhookResult> {
  const settings = await getLeadWebhookSettings();
  if (!settings.inlineContactWebhookEnabled) {
    return { status: 'disabled', attempts: 0, lastError: 'inline-contact-webhook-disabled' };
  }

  const phone = normalizePhoneForPayload(lead.phoneE164 || lead.phoneRaw, 'MA');
  if (!phone.ok) {
    await leadRepo.markWebhookFailed(lead.id, `invalid-phone:${phone.reason}`);
    await eventRepo.append(lead.sessionId, 'inline_contact_webhook_failed', {
      leadId: lead.id,
      reason: `invalid-phone:${phone.reason}`,
    });
    return {
      status: 'skipped',
      attempts: 0,
      lastError: `invalid-phone:${phone.reason}`,
    };
  }

  const noteParts: string[] = [];
  if (lead.note) noteParts.push(lead.note.trim());
  noteParts.push('trigger:inline-contact');
  if (lead.intentAtCapture) noteParts.push(`intent:${lead.intentAtCapture}`);

  const conversation = settings.conversationEnabled
    ? snapshotMessagesToConversation(lead.snapshotMessages, {
        userName: lead.firstName,
        maxMessages: settings.conversationMaxMessages,
        maxBytes: settings.conversationMaxBytes,
      })
    : undefined;

  const result = await dispatchToAllChannels({
    source: 'inline-contact',
    sourceId: lead.id,
    idempotencyKey: `inline-contact:${lead.id}`,
    eventName: 'chat_lead.created',
    adminEventNames: ['chat_lead.created', 'lead.created'],
    payload: {
      id: `inline-contact:${lead.id}`,
      full_name: composeFullName(lead.firstName),
      phone: phone.value,
      source: lead.source ?? 'chat_widget',
      conversation,
      note: noteParts.join(' | '),
      source_channel: `chat:inline-contact`,
      quantity: 1,
      currency: 'MAD' as const,
    },
  });

  // Synchronise le statut chat_lead.webhook_status pour l'admin.
  if (result.status === 'sent') {
    await leadRepo.markWebhookSent(lead.id);
    await eventRepo.append(lead.sessionId, 'inline_contact_webhook_sent', {
      leadId: lead.id,
      attempts: result.attempts,
      responseStatus: result.responseStatus,
    });
  } else if (result.status === 'failed' || result.status === 'skipped') {
    await leadRepo.markWebhookFailed(lead.id, result.lastError ?? result.status);
    await eventRepo.append(lead.sessionId, 'inline_contact_webhook_failed', {
      leadId: lead.id,
      attempts: result.attempts,
      reason: result.lastError ?? result.status,
    });
  } else if (result.status === 'disabled') {
    await leadRepo.markWebhookFailed(lead.id, 'webhook-not-configured');
    await eventRepo.append(lead.sessionId, 'inline_contact_webhook_failed', {
      leadId: lead.id,
      reason: 'webhook-not-configured',
    });
  }

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}