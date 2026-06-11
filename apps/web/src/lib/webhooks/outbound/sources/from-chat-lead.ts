/**
 * CHA-260 — Builder webhook outbound pour les chat leads.
 *
 * Remplace l'ancien format `{event, version, occurredAt, lead}` (CHA-206)
 * par le payload PLAT unifié (contrat §1). Le lead arrive depuis
 * `POST /api/chat/lead/contact` après persistance.
 *
 * Dispatch désormais vers les endpoints admin EN PRIORITÉ, puis fallback
 * outbound URL si aucun endpoint admin ne matche.
 *
 * Phone-gate : un chat lead est créé uniquement si `phoneE164` valide
 * (validation amont via `parsePhone`), donc le skip est défensif.
 *
 * Met à jour `chat_lead.webhook_status` selon le résultat dispatcher
 * pour garder l'admin /admin/chat/leads cohérent.
 */
import { eventRepo } from '@/lib/chat/repos/event';
import { leadRepo } from '@/lib/chat/repos/lead';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';
import { snapshotMessagesToConversation } from '../helpers/conversation';
import { getLeadWebhookSettings } from '../settings';

export interface DispatchChatLeadResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

export async function dispatchChatLeadWebhook(
  lead: ChatLeadRow,
): Promise<DispatchChatLeadResult> {
  const phone = normalizePhoneForPayload(lead.phoneE164 || lead.phoneRaw, 'MA');

  if (!phone.ok) {
    await leadRepo.markWebhookFailed(lead.id, `invalid-phone:${phone.reason}`);
    await eventRepo.append(lead.sessionId, 'chat_lead_webhook_failed', {
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
  if (lead.triggerReason) noteParts.push(`trigger:${lead.triggerReason}`);
  if (lead.intentAtCapture) noteParts.push(`intent:${lead.intentAtCapture}`);

  const settings = await getLeadWebhookSettings();
  const conversation = settings.conversationEnabled
    ? snapshotMessagesToConversation(lead.snapshotMessages, {
        userName: lead.firstName,
        maxMessages: settings.conversationMaxMessages,
        maxBytes: settings.conversationMaxBytes,
      })
    : undefined;

  const payload = {
    id: `chat-lead:${lead.id}`,
    full_name: composeFullName(lead.firstName),
    phone: phone.value,
    source: lead.source ?? 'chat_widget',
    conversation,
    email: lead.email ?? undefined,
    note: noteParts.length ? noteParts.join(' | ') : undefined,
    source_channel: `chat:${lead.triggerReason ?? 'manual'}`,
    // Lead chat = lead finalisé (nom + tél + consentement + conversation),
    // pas un panier abandonné → l'opérateur le voit complet d'emblée.
    lead_status: 'complete' as const,
    quantity: 1,
    currency: 'MAD' as const,
  };

  const result = await dispatchToAllChannels({
    source: 'chat-lead',
    sourceId: lead.id,
    idempotencyKey: `chat-lead:${lead.id}`,
    eventName: 'chat_lead.created',
    adminEventNames: ['chat_lead.created', 'lead.created'],
    payload,
  });

  // Synchronise le statut chat_lead.webhook_status pour /admin/chat/leads.
  if (result.status === 'sent') {
    await leadRepo.markWebhookSent(lead.id);
    await eventRepo.append(lead.sessionId, 'chat_lead_webhook_sent', {
      leadId: lead.id,
      attempts: result.attempts,
      responseStatus: result.responseStatus,
    });
  } else if (result.status === 'failed' || result.status === 'skipped') {
    await leadRepo.markWebhookFailed(lead.id, result.lastError ?? result.status);
    await eventRepo.append(lead.sessionId, 'chat_lead_webhook_failed', {
      leadId: lead.id,
      attempts: result.attempts,
      reason: result.lastError ?? result.status,
    });
  } else if (result.status === 'disabled') {
    await leadRepo.markWebhookFailed(lead.id, 'webhook-not-configured');
    await eventRepo.append(lead.sessionId, 'chat_lead_webhook_failed', {
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