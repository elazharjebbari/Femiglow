/**
 * CHA-206 — Service `lead-webhook`.
 *
 * Envoi côté serveur d'un événement `lead.created` vers un endpoint
 * externe (n8n / Zapier / CRM custom). Le payload est signé HMAC-SHA-256
 * via `CHAT_LEAD_WEBHOOK_SECRET` pour permettre au receveur de
 * vérifier l'authenticité.
 *
 * Cycle :
 *  1. `dispatchLeadWebhook(lead)` est appelé par la route POST
 *     /api/chat/lead/contact APRÈS persistance du lead.
 *  2. Le service tente jusqu'à 3 envois avec backoff (1s/3s/9s).
 *  3. Met à jour `chat_lead.webhook_status` via `leadRepo`.
 *  4. Trace event `chat_lead_webhook_sent` ou `chat_lead_webhook_failed`.
 *
 * Si `CHAT_LEAD_WEBHOOK_URL` est absent, on marque `webhook_status='disabled'`
 * silencieusement — le lead reste capturé en DB et l'admin peut le
 * traiter manuellement.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.3
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';

import { eventRepo } from '../repos/event';
import { leadRepo } from '../repos/lead';
import type { ChatLeadRow } from '../db/schema';

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const BACKOFFS_MS = [1000, 3000, 9000];

export interface LeadWebhookPayload {
  event: 'lead.created';
  /** Version du contrat — bump si breaking change. */
  version: '1';
  occurredAt: string; // ISO 8601
  lead: {
    id: string;
    sessionId: string;
    triggeringMessageId: string | null;
    triggerReason: ChatLeadRow['triggerReason'];
    firstName: string;
    phoneE164: string;
    phoneRaw: string;
    note: string | null;
    consentVersion: string;
    consentAt: string;
    language: string;
    intentAtCapture: string | null;
    page: string | null;
    referrer: string | null;
    utm: Record<string, string> | null;
    snapshot: Array<{ role: 'user' | 'assistant'; content: string; at: string }> | null;
  };
}

/** Signe un payload JSON et renvoie l'en-tête `X-Femiglow-Signature`. */
export function signWebhookPayload(rawBody: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/** Vérification (pour tests + receveurs internes). */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = signWebhookPayload(rawBody, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function buildPayload(lead: ChatLeadRow): LeadWebhookPayload {
  return {
    event: 'lead.created',
    version: '1',
    occurredAt: new Date().toISOString(),
    lead: {
      id: lead.id,
      sessionId: lead.sessionId,
      triggeringMessageId: lead.triggeringMessageId,
      triggerReason: lead.triggerReason,
      firstName: lead.firstName,
      phoneE164: lead.phoneE164,
      phoneRaw: lead.phoneRaw,
      note: lead.note,
      consentVersion: lead.consentVersion,
      consentAt: lead.consentAt.toISOString(),
      language: lead.language,
      intentAtCapture: lead.intentAtCapture,
      page: lead.page,
      referrer: lead.referrer,
      utm: lead.utm,
      snapshot: lead.snapshotMessages,
    },
  };
}

async function deliverOnce(
  url: string,
  body: string,
  signature: string,
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-femiglow-signature': signature,
        'x-femiglow-event': 'lead.created',
        accept: 'application/json',
      },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, reason: `http-${res.status}: ${txt.slice(0, 100)}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: (err as Error).message ?? 'network-error' };
  } finally {
    clearTimeout(t);
  }
}

export async function dispatchLeadWebhook(lead: ChatLeadRow): Promise<{
  status: 'sent' | 'failed' | 'disabled';
  attempts: number;
  lastError?: string;
}> {
  const url = env.CHAT_LEAD_WEBHOOK_URL;
  const secret = env.CHAT_LEAD_WEBHOOK_SECRET;
  if (!url || !secret) {
    logger.info('chat.lead.webhook.disabled', { leadId: lead.id });
    await eventRepo.append(lead.sessionId, 'chat_lead_webhook_failed', {
      leadId: lead.id,
      reason: 'webhook-not-configured',
    });
    return { status: 'disabled', attempts: 0, lastError: 'webhook-not-configured' };
  }

  const payload = buildPayload(lead);
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, secret);

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const r = await deliverOnce(url, body, signature);
    if (r.ok) {
      await leadRepo.markWebhookSent(lead.id);
      await eventRepo.append(lead.sessionId, 'chat_lead_webhook_sent', {
        leadId: lead.id,
        attempt,
        status: r.status,
      });
      logger.info('chat.lead.webhook.sent', { leadId: lead.id, attempt });
      return { status: 'sent', attempts: attempt };
    }
    lastError = r.reason;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((res) => setTimeout(res, BACKOFFS_MS[attempt - 1] ?? 5000));
    }
  }

  await leadRepo.markWebhookFailed(lead.id, lastError ?? 'unknown');
  await eventRepo.append(lead.sessionId, 'chat_lead_webhook_failed', {
    leadId: lead.id,
    attempts: MAX_ATTEMPTS,
    reason: lastError ?? 'unknown',
  });
  logger.warn('chat.lead.webhook.failed', { leadId: lead.id, reason: lastError });
  return { status: 'failed', attempts: MAX_ATTEMPTS, lastError };
}

export const leadWebhook = {
  dispatch: dispatchLeadWebhook,
  sign: signWebhookPayload,
  verify: verifyWebhookSignature,
};
