/**
 * CHAT-066/068 — Alertes Slack quand un lead "chaud" arrive.
 *
 * Pourquoi
 * ────────
 * Le webhook outbound CRM peut prendre quelques secondes à atteindre n8n.
 * L'équipe care veut être pinguée immédiatement sur Slack quand un lead
 * "hot" tombe (purchase-intent, callback-request, explicit-request), pour
 * rappeler dans les ~5 min et maximiser la conversion.
 *
 * Conditions
 * ──────────
 *  - `triggerReason` ∈ HOT_REASONS
 *  - Le webhook Slack est configuré (sinon no-op silencieux)
 *
 * RGPD : on n'envoie PAS le téléphone ni l'email à Slack — juste prénom,
 * raison, langue, et un lien admin pour ouvrir la fiche lead.
 *
 * Non bloquant : le caller fait `void notifyHotLead(...)` — toute erreur
 * est loggée mais n'impacte pas la réponse HTTP.
 */
import { logger } from '@/lib/logging/logger';

import type { ChatLeadRow } from '../db/schema';
import { sendChatAlert } from './slack-notify';

const HOT_REASONS = new Set<ChatLeadRow['triggerReason']>([
  'purchase-intent',
  'explicit-request',
  'inline-contact',
]);

export async function notifyHotLead(
  lead: Pick<ChatLeadRow, 'id' | 'triggerReason' | 'firstName' | 'language' | 'createdAt'>,
  opts: { adminBaseUrl?: string } = {},
): Promise<boolean> {
  if (!HOT_REASONS.has(lead.triggerReason)) {
    return false;
  }
  const adminLink = opts.adminBaseUrl
    ? `${opts.adminBaseUrl.replace(/\/$/, '')}/admin/chat/leads/${lead.id}`
    : null;

  try {
    return await sendChatAlert({
      title: `Lead chaud — ${lead.triggerReason}`,
      detail: `${lead.firstName} vient de soumettre un lead "${lead.triggerReason}". À rappeler dans les 5 min.`,
      severity: 'critical',
      fields: [
        { label: 'Prénom', value: lead.firstName },
        { label: 'Raison', value: lead.triggerReason },
        { label: 'Langue', value: lead.language ?? 'fr' },
        ...(adminLink ? [{ label: 'Fiche admin', value: adminLink }] : []),
      ],
    });
  } catch (err) {
    logger.warn('chat.lead.alert_failed', {
      leadId: lead.id,
      reason: (err as Error).message,
    });
    return false;
  }
}
