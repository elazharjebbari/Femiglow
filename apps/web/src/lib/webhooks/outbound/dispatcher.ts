/**
 * CHA-260 — Dispatcher unifié des webhooks outbound (PLAT).
 *
 * Pipeline d'envoi :
 *   1. Récupère URL/secret depuis env (priorité `OUTBOUND_WEBHOOK_URL`,
 *      fallback `CHAT_LEAD_WEBHOOK_URL` pour rétrocompat CHA-206).
 *   2. Valide le payload via `validateOutboundPayload` (Zod strict).
 *      → si invalide → status='skipped', reason='validation-failed'.
 *   3. Insère un log idempotent (`createOutboundLog`) ; si l'idem-key
 *      existe déjà avec status='sent' → court-circuit.
 *   4. Signe HMAC-SHA-256 → header `x-femiglow-signature`.
 *   5. POST flat body, retry 3× backoff [1s, 3s, 9s].
 *   6. `recordOutboundAttempt` final avec status, latency, response code.
 *
 * Les headers conventionnels :
 *   - `content-type: application/json`
 *   - `accept: application/json`
 *   - `user-agent: femiglow-webhook/1.0`
 *   - `x-femiglow-event: <eventName>`        — ex. `order.completed`
 *   - `x-femiglow-source: <source>`          — ex. `order`
 *   - `x-femiglow-signature: sha256=<hex>`   — HMAC du raw body
 *   - `idempotency-key: <payload.id>`        — dedup côté receveur
 *
 * cf. `docs/webhooks/outbound-webhook-runbook.md` §3-§4.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import type { OutboundSource, OutboundStatus, OutboundWebhookLogRow } from '@/lib/db/types';

import {
  OutboundPayloadValidationError,
  validateOutboundPayload,
  type OutboundPayload,
} from './payload';
import {
  createOutboundLog,
  getOutboundLogByIdempotency,
  recordOutboundAttempt,
} from './log-queries';

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const BACKOFFS_MS = [1000, 3000, 9000];
const USER_AGENT = 'femiglow-webhook/1.0';

export interface DispatchInput {
  /** Logique source pour le log (1 row = 1 source-event). */
  source: OutboundSource;
  /** Identifiant côté FemiGlow (`order.id`, `chat_lead.id`, …). */
  sourceId: string;
  /** Clé d'idempotence du receveur (mirror de `payload.id` recommandé). */
  idempotencyKey: string;
  /** Nom métier (`order.completed`, `chat_lead.created`, …). */
  eventName: string;
  /** Payload candidat — sera validé via `validateOutboundPayload`. */
  payload: unknown;
}

export interface DispatchResult {
  status: OutboundStatus;
  attempts: number;
  responseStatus?: number;
  lastError?: string;
  /** Pointeur vers la row de log pour traçage admin. */
  logId?: string;
  /** Le payload validé tel qu'envoyé (utile pour tests et debug). */
  sentPayload?: OutboundPayload;
}

/**
 * Résout URL et secret avec priorité OUTBOUND_* puis fallback CHAT_LEAD_*.
 * Permet une transition douce sans casser le pipeline historique CHA-206.
 */
export function resolveWebhookEndpoint(): { url: string; secret: string } | null {
  const url = env.OUTBOUND_WEBHOOK_URL ?? env.CHAT_LEAD_WEBHOOK_URL;
  const secret = env.OUTBOUND_WEBHOOK_SECRET ?? env.CHAT_LEAD_WEBHOOK_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

/** Signe un payload JSON. */
export function signOutboundBody(rawBody: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/** Vérification timing-safe pour tests + receveurs internes. */
export function verifyOutboundSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = signOutboundBody(rawBody, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface DeliveryAttempt {
  ok: boolean;
  status?: number;
  reason?: string;
  latencyMs: number;
}

async function deliverOnce(args: {
  url: string;
  body: string;
  signature: string;
  source: OutboundSource;
  eventName: string;
  idempotencyKey: string;
}): Promise<DeliveryAttempt> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': USER_AGENT,
        'x-femiglow-event': args.eventName,
        'x-femiglow-source': args.source,
        'x-femiglow-signature': args.signature,
        'idempotency-key': args.idempotencyKey,
      },
      body: args.body,
      signal: ctrl.signal,
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        latencyMs,
        reason: `http-${res.status}: ${txt.slice(0, 200)}`,
      };
    }
    return { ok: true, status: res.status, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      reason: (err as Error).message ?? 'network-error',
    };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Court-circuit pré-dispatch : si une row `sent` existe déjà pour cette
 * idem-key, on évite tout HTTP — anti-doublon strict.
 */
async function shortCircuitIfSent(
  idempotencyKey: string,
): Promise<OutboundWebhookLogRow | null> {
  const existing = await getOutboundLogByIdempotency(idempotencyKey);
  if (existing && existing.status === 'sent') return existing;
  return null;
}

/**
 * Point d'entrée principal — appelé par les builders `sources/*`.
 */
export async function dispatchOutbound(input: DispatchInput): Promise<DispatchResult> {
  // 1. Validation payload (lance OutboundPayloadValidationError si invalide).
  let validated: OutboundPayload;
  try {
    validated = validateOutboundPayload(input.payload);
  } catch (err) {
    const reason =
      err instanceof OutboundPayloadValidationError
        ? `validation-failed: ${err.issues.map((i) => i.path.join('.') + ' ' + i.message).join('|')}`
        : (err as Error).message;
    logger.warn('outbound.webhook.skipped', {
      source: input.source,
      sourceId: input.sourceId,
      reason,
    });
    const log = await createOutboundLog({
      source: input.source,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      eventName: input.eventName,
      payload:
        input.payload && typeof input.payload === 'object'
          ? (input.payload as Record<string, unknown>)
          : { raw: String(input.payload) },
      status: 'pending',
    });
    const updated = await recordOutboundAttempt({
      id: log.id,
      status: 'skipped',
      attemptCount: 0,
      lastError: reason,
    });
    return {
      status: 'skipped',
      attempts: 0,
      lastError: reason,
      logId: updated.id,
    };
  }

  // 2. Configuration endpoint.
  const endpoint = resolveWebhookEndpoint();
  if (!endpoint) {
    logger.info('outbound.webhook.disabled', {
      source: input.source,
      sourceId: input.sourceId,
      reason: 'no-endpoint-configured',
    });
    const log = await createOutboundLog({
      source: input.source,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      eventName: input.eventName,
      payload: validated as unknown as Record<string, unknown>,
      status: 'pending',
    });
    const updated = await recordOutboundAttempt({
      id: log.id,
      status: 'disabled',
      attemptCount: 0,
      lastError: 'no-endpoint-configured',
    });
    return {
      status: 'disabled',
      attempts: 0,
      lastError: 'no-endpoint-configured',
      logId: updated.id,
      sentPayload: validated,
    };
  }

  // 3. Court-circuit si déjà envoyé (anti-doublon).
  const alreadySent = await shortCircuitIfSent(input.idempotencyKey);
  if (alreadySent) {
    logger.info('outbound.webhook.dedup', {
      source: input.source,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      logId: alreadySent.id,
    });
    return {
      status: 'sent',
      attempts: alreadySent.attemptCount,
      responseStatus: alreadySent.responseStatus ?? undefined,
      logId: alreadySent.id,
      sentPayload: validated,
    };
  }

  // 4. Création du log (idempotent — ON CONFLICT DO NOTHING).
  const log = await createOutboundLog({
    source: input.source,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    eventName: input.eventName,
    payload: validated as unknown as Record<string, unknown>,
    status: 'pending',
  });
  if (log.status === 'sent') {
    return {
      status: 'sent',
      attempts: log.attemptCount,
      responseStatus: log.responseStatus ?? undefined,
      logId: log.id,
      sentPayload: validated,
    };
  }

  // 5. Sign + envoi avec retry.
  const body = JSON.stringify(validated);
  const signature = signOutboundBody(body, endpoint.secret);

  let lastReason: string | undefined;
  let lastStatus: number | undefined;
  let lastLatency = 0;
  let attempt = 0;
  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const r = await deliverOnce({
      url: endpoint.url,
      body,
      signature,
      source: input.source,
      eventName: input.eventName,
      idempotencyKey: input.idempotencyKey,
    });
    lastLatency = r.latencyMs;
    lastStatus = r.status;
    if (r.ok) {
      const updated = await recordOutboundAttempt({
        id: log.id,
        status: 'sent',
        attemptCount: attempt,
        responseStatus: r.status ?? null,
        latencyMs: r.latencyMs,
        sentAt: new Date(),
      });
      logger.info('outbound.webhook.sent', {
        source: input.source,
        sourceId: input.sourceId,
        eventName: input.eventName,
        attempt,
        responseStatus: r.status,
        latencyMs: r.latencyMs,
        logId: updated.id,
      });
      return {
        status: 'sent',
        attempts: attempt,
        responseStatus: r.status,
        logId: updated.id,
        sentPayload: validated,
      };
    }
    lastReason = r.reason;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((res) => setTimeout(res, BACKOFFS_MS[attempt - 1] ?? 5000));
    }
  }

  // 6. Échec final.
  const updated = await recordOutboundAttempt({
    id: log.id,
    status: 'failed',
    attemptCount: MAX_ATTEMPTS,
    responseStatus: lastStatus ?? null,
    latencyMs: lastLatency,
    lastError: lastReason ?? 'unknown',
  });
  logger.warn('outbound.webhook.failed', {
    source: input.source,
    sourceId: input.sourceId,
    eventName: input.eventName,
    attempts: MAX_ATTEMPTS,
    responseStatus: lastStatus,
    reason: lastReason,
    logId: updated.id,
  });
  return {
    status: 'failed',
    attempts: MAX_ATTEMPTS,
    responseStatus: lastStatus,
    lastError: lastReason,
    logId: updated.id,
    sentPayload: validated,
  };
}

export const outboundDispatcher = {
  dispatch: dispatchOutbound,
  sign: signOutboundBody,
  verify: verifyOutboundSignature,
  resolveEndpoint: resolveWebhookEndpoint,
};
