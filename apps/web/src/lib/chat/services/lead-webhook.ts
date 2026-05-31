/**
 * CHA-206 / CHA-260 — Façade rétrocompat `dispatchLeadWebhook`.
 *
 * Depuis CHA-260, l'envoi réel passe par le dispatcher outbound unifié
 * (`@/lib/webhooks/outbound/dispatcher`) avec un payload PLAT. Ce module
 * conserve l'ancienne signature pour la route POST /api/chat/lead/contact
 * et les tests existants, mais délègue intégralement à
 * `dispatchChatLeadWebhook`.
 *
 * Les helpers `signWebhookPayload` / `verifyWebhookSignature` sont
 * exposés comme alias de `signOutboundBody` / `verifyOutboundSignature`
 * (même algo HMAC-SHA-256) pour ne pas casser les receveurs internes
 * et les utilitaires de tests.
 *
 * cf. `docs/webhooks/outbound-webhook-runbook.md` §2.2.
 */
import {
  signOutboundBody,
  verifyOutboundSignature,
} from '@/lib/webhooks/outbound/dispatcher';
import { dispatchChatLeadWebhook } from '@/lib/webhooks/outbound/sources/from-chat-lead';
import type { ChatLeadRow } from '../db/schema';

/** Alias HMAC-SHA-256 — identique à `signOutboundBody`. */
export const signWebhookPayload = signOutboundBody;
/** Alias de vérification timing-safe — identique à `verifyOutboundSignature`. */
export const verifyWebhookSignature = verifyOutboundSignature;

export interface LegacyDispatchResult {
  status: 'sent' | 'failed' | 'disabled';
  attempts: number;
  lastError?: string;
}

/**
 * Façade rétrocompat — appelle le dispatcher outbound unifié et mappe
 * le statut `skipped` (phone-gate) sur `failed` pour préserver le type
 * historique côté route (cf. `webhookStatus` dans /api/chat/lead/contact).
 */
export async function dispatchLeadWebhook(
  lead: ChatLeadRow,
): Promise<LegacyDispatchResult> {
  const r = await dispatchChatLeadWebhook(lead);
  const status: LegacyDispatchResult['status'] =
    r.status === 'skipped' ? 'failed' : (r.status as LegacyDispatchResult['status']);
  return {
    status,
    attempts: r.attempts,
    lastError: r.lastError,
  };
}

export const leadWebhook = {
  dispatch: dispatchLeadWebhook,
  sign: signWebhookPayload,
  verify: verifyWebhookSignature,
};
