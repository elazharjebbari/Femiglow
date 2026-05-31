/**
 * CHA-260 — Builder webhook outbound pour le formulaire de contact.
 *
 * Dispatch désormais vers les endpoints admin EN PRIORITÉ, puis fallback
 * outbound URL si aucun endpoint admin ne matche.
 */
import { createId } from '@/lib/ids';

import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';

export interface ContactWebhookInput {
  type: 'question' | 'order' | 'professional';
  name: string;
  email: string;
  phone?: string | null;
  orderNumber?: string | null;
  companyName?: string | null;
  role?: string | null;
  message: string;
  newsletterOptIn?: boolean;
  ip?: string | null;
}

export interface ContactWebhookResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
  /** ID frais généré pour cette submission (`contact_xxx`). */
  contactId: string;
}

export async function dispatchContactWebhook(
  input: ContactWebhookInput,
): Promise<ContactWebhookResult> {
  const contactId = createId('contact');

  const phone = normalizePhoneForPayload(input.phone ?? null, 'MA');
  if (!phone.ok) {
    return {
      status: 'skipped',
      attempts: 0,
      lastError: `invalid-phone:${phone.reason}`,
      contactId,
    };
  }

  const noteParts: string[] = [`[${input.type}]`, input.message.trim()];
  if (input.orderNumber) noteParts.push(`order:${input.orderNumber}`);
  if (input.companyName) noteParts.push(`company:${input.companyName}`);
  if (input.role) noteParts.push(`role:${input.role}`);
  if (input.newsletterOptIn) noteParts.push('newsletter-opt-in');

  const result = await dispatchToAllChannels({
    source: 'contact',
    sourceId: contactId,
    idempotencyKey: contactId,
    eventName: 'contact.submitted',
    adminEventNames: ['contact.submitted'],
    payload: {
      id: contactId,
      full_name: composeFullName(input.name),
      phone: phone.value,
      email: input.email,
      note: noteParts.join(' | ').slice(0, 1990),
      source_channel: `contact-form:${input.type}`,
      quantity: 1,
      currency: 'MAD' as const,
      ip: input.ip ?? undefined,
    },
  });

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
    contactId,
  };
}