/**
 * CHA-260 — Builder webhook outbound pour le formulaire de contact.
 *
 * Phone-gate strict :
 *   - phone absent / invalide → `status='skipped'`, AUCUN appel HTTP.
 *   - sinon → payload PLAT envoyé via dispatcher unifié.
 *
 * Pas de FK stable côté DB (le contact form n'est pas persisté en
 * `contact_submission` à ce stade) — l'idempotency-key est un id frais
 * généré par submission. Le receveur peut dédoublonner par
 * `(email, message_hash, time_window)` si besoin.
 *
 * cf. `docs/webhooks/outbound-webhook-runbook.md` §2.4.
 */
import { createId } from '@/lib/ids';

import { dispatchOutbound, type DispatchResult } from '../dispatcher';
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
  status: DispatchResult['status'];
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

  // Phone-gate : pas de téléphone exploitable → on N'ENVOIE PAS et on
  // ne crée pas de log non plus (les contacts sans phone restent
  // traités par l'email du formulaire — pas de double-tracking).
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

  const payload = {
    id: contactId,
    full_name: composeFullName(input.name),
    phone: phone.value,
    email: input.email,
    note: noteParts.join(' | ').slice(0, 1990),
    source_channel: `contact-form:${input.type}`,
    quantity: 1,
    currency: 'MAD',
    ip: input.ip ?? undefined,
  };

  const result = await dispatchOutbound({
    source: 'contact',
    sourceId: contactId,
    idempotencyKey: contactId,
    eventName: 'contact.submitted',
    payload,
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
