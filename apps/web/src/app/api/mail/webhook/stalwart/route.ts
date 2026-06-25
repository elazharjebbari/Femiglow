/**
 * Stalwart → FemiGlow webhook receiver.
 *
 *   - Auth : Bearer FEMIGLOW_STALWART_WEBHOOK_SECRET (constant-time compare)
 *   - Payload : discriminated union (see stalwart-parser.ts)
 *   - Idempotent : looking up outbox by smtp_message_id ; hard-bounce inserts
 *     a suppression entry with ON CONFLICT DO NOTHING.
 *
 * Cf. docs/emailing/03-backend-integration.md §4.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { env } from '@/lib/env';
import { db as getDb } from '@/lib/db/client';
import {
  emailOutbox,
  emailEvent,
  emailSuppression,
} from '@/lib/db/schema-emails';
import { bridgeStalwartToUserEvent } from '@/lib/user-events/bridges/email-webhooks';
import { logger } from '@/lib/logging/logger';
import {
  isHardBounce,
  isKnownEvent,
  messageIdMatchForms,
  normalizeStalwartPayload,
  type StalwartWebhookEvent,
} from '@/lib/mail/webhooks/stalwart-parser';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest): Promise<Response> {
  const blocked = await enforceMailRateLimit('webhook-stalwart', req);
  if (blocked) return blocked;

  const secret = env.FEMIGLOW_STALWART_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('mail.webhook.stalwart.no_secret_configured');
    return new NextResponse('Webhook not configured', { status: 503 });
  }

  // Stalwart's HttpAuth Bearer schema is not documented in NDJSON apply.
  // We use a custom header (X-FG-Webhook-Token) configured in the WebHook's
  // httpHeaders map instead — simpler and equally secure.
  const token = req.headers.get('x-fg-webhook-token') ?? '';
  if (!constantTimeEqual(token, secret)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  // Accept BOTH the legacy flat envelope ({ event, … }) AND the native
  // Stalwart v0.16 BATCH envelope ({ events: [{ id, createdAt, type, data }] }).
  // `normalizeStalwartPayload` always yields a flat-event ARRAY (R-021).
  const normalized = normalizeStalwartPayload(raw);
  if (!normalized.ok) {
    logger.warn('mail.webhook.stalwart.bad_payload', { issues: normalized.issues });
    return new NextResponse('Bad payload', { status: 400 });
  }

  const drizzle = getDb();
  if (!drizzle) {
    logger.warn('mail.webhook.stalwart.db_not_configured');
    return NextResponse.json({ ok: false, error: 'db-not-configured' }, { status: 503 });
  }

  // Process every event in the request. Per-event errors are ISOLATED : a
  // single failing event must not fail the whole batch (Stalwart would replay
  // the ENTIRE batch → re-applying the events that already succeeded). We
  // collect a per-event result and always answer 200 once we got past auth +
  // schema validation.
  const results: Array<{ event: string; status: string }> = [];
  for (const evt of normalized.events) {
    try {
      const r = await processStalwartEvent(drizzle, evt);
      results.push({ event: evt.event, status: r });
    } catch (err) {
      logger.error('mail.webhook.stalwart.event_error', {
        event: evt.event,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({ event: evt.event, status: 'error' });
    }
  }

  // Backward-compat : for a single-event request (the legacy flat envelope),
  // mirror an "ignored" reason at the top level when the event was a no-op
  // (unhandled-event / no-message-id / unknown-message-id). Existing callers
  // and tests key on `body.ignored` ; batches expose the full `results` array.
  const single = results.length === 1 ? results[0] : null;
  const ignoredReasons = new Set(['unhandled-event', 'no-message-id', 'unknown-message-id']);
  const body: Record<string, unknown> = { ok: true, processed: results.length, results };
  if (single && ignoredReasons.has(single.status)) {
    body.ignored = single.status;
  }
  return NextResponse.json(body);
}

/**
 * Apply ONE flat Stalwart event to the DB. Returns a short status string for
 * observability. Throws on unexpected DB errors (caught + isolated per-event
 * by the caller). The bridge to user_event stays fire-and-forget.
 */
async function processStalwartEvent(
  drizzle: NonNullable<ReturnType<typeof getDb>>,
  evt: StalwartWebhookEvent,
): Promise<string> {
  // NB: ne PAS nommer ce champ `event` — il écraserait la clé `event` du payload
  // du logger (spread) et le log apparaîtrait sous le nom de l'événement Stalwart.
  logger.info('mail.webhook.stalwart.received', { stalwart_event: evt.event });

  if (!isKnownEvent(evt)) {
    // Depuis 2026-06-05 le webhook Stalwart est filtré (eventsPolicy=include sur
    // les 6 events traités ici — cf. configure-stalwart-webhook.sh --filter-events).
    // On garde le garde-fou : tout event inattendu est ignoré silencieusement
    // pour que Stalwart ne retente pas en boucle.
    return 'unhandled-event';
  }

  if (evt.event === 'auth.failed') {
    logger.warn('mail.smtp.auth_failed', { user: evt.user, ip: evt.ip });
    return 'auth-failed-logged';
  }

  // Locate the originating outbox row by Message-ID. CRITICAL : Stalwart reports
  // the Message-ID WITHOUT angle brackets (`abc@d`) while the app stores it WITH
  // (`<abc@d>` — nodemailer `info.messageId`). On matche les DEUX formes via
  // `messageIdMatchForms` ; sans ça le `eq()` strict ne matchait JAMAIS et le
  // statut `delivered`/`bounced` ne se peuplait pas (« webhook silencieux »).
  const messageId =
    'messageId' in evt && typeof evt.messageId === 'string' ? evt.messageId : null;

  const matched = messageId
    ? await drizzle
        .select()
        .from(emailOutbox)
        .where(inArray(emailOutbox.smtpMessageId, messageIdMatchForms(messageId)))
        .limit(1)
    : [];
  const outbox = matched.length > 0 && matched[0] ? matched[0] : null;

  // DSN failure notifications portent SOUVENT aucun messageId (juste queueId +
  // destinataire). Traitées à part : bounce sur la ligne outbox si matchée,
  // sinon (échec PERMANENT) on supprime le destinataire pour la délivrabilité.
  if (evt.event === 'delivery.dsn-perm-fail' || evt.event === 'delivery.dsn-temp-fail') {
    return processDsnFailure(drizzle, evt, outbox);
  }

  if (!messageId) {
    logger.info('mail.webhook.stalwart.no_message_id', { stalwart_event: evt.event });
    return 'no-message-id';
  }
  if (!outbox) {
    // May be a message originating from Listmonk (uses its own Message-ID
    // namespace) ; that path is handled via the Listmonk webhook.
    return 'unknown-message-id';
  }

  const evtTs = 'ts' in evt && typeof evt.ts === 'string' ? evt.ts : null;
  const ts = evtTs ? new Date(evtTs) : new Date();
  const rawJson = evt as unknown as Record<string, unknown>;

  let status = 'ok';

  if (evt.event === 'queue.message-queued' || evt.event === 'queue.authenticated-message-queued') {
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'queued',
      source: 'stalwart',
      ts,
      rawJson,
    });
    status = 'queued';
  } else if (evt.event === 'delivery.delivered') {
    await drizzle
      .update(emailOutbox)
      .set({ status: 'delivered', deliveredAt: ts, updatedAt: new Date() })
      .where(eq(emailOutbox.id, outbox.id));
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'delivered',
      source: 'stalwart',
      ts,
      rawJson,
    });
    status = 'delivered';
  } else if (evt.event === 'delivery.failed') {
    const errorCode = 'errorCode' in evt && typeof evt.errorCode === 'number' ? evt.errorCode : undefined;
    const reason = 'reason' in evt && typeof evt.reason === 'string' ? evt.reason : 'unknown';
    const isHard = isHardBounce(errorCode);
    await drizzle
      .update(emailOutbox)
      .set({
        status: isHard ? 'bounced_permanent' : 'bounced_soft',
        bouncedAt: ts,
        bounceReason: reason,
        bounceType: isHard ? 'hard' : 'soft',
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, outbox.id));
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: isHard ? 'bounced_hard' : 'bounced_soft',
      source: 'stalwart',
      ts,
      rawJson,
    });
    if (isHard) {
      await drizzle
        .insert(emailSuppression)
        .values({
          email: outbox.toEmail,
          reason: 'hard_bounce',
          detail: reason,
          source: 'stalwart',
        })
        .onConflictDoNothing();
    }
    status = isHard ? 'bounced_hard' : 'bounced_soft';
  } else if (evt.event === 'queue.rescheduled') {
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'retried',
      source: 'stalwart',
      ts,
      rawJson,
    });
    status = 'retried';
  }

  // M5.2 — bridge vers user_event (unified). Fire-and-forget : ne bloque
  // jamais le webhook (sinon Stalwart relance, retry-storm).
  if (evt.event === 'delivery.delivered' || evt.event === 'delivery.failed') {
    const errorCode =
      evt.event === 'delivery.failed' && 'errorCode' in evt && typeof evt.errorCode === 'number'
        ? evt.errorCode
        : undefined;
    const reason =
      evt.event === 'delivery.failed' && 'reason' in evt && typeof evt.reason === 'string'
        ? evt.reason
        : undefined;
    void bridgeStalwartToUserEvent({
      event: evt.event,
      rcpt: outbox.toEmail,
      messageId: outbox.smtpMessageId ?? undefined,
      errorCode,
      reason,
      ts: evtTs ?? undefined,
    });
  }

  return status;
}

/**
 * Traite un DSN d'échec outbound (`delivery.dsn-perm-fail` / `dsn-temp-fail`).
 *
 * Ces events ne portent souvent PAS de messageId (corrélation par id impossible),
 * mais portent le destinataire. Deux cas :
 *  - ligne outbox matchée (par messageId, rare) → bounce dessus + email_event ;
 *  - pas de match → échec PERMANENT : on insère une suppression sur le
 *    destinataire (idempotent) pour ne plus lui réenvoyer ; échec TEMPORAIRE
 *    sans match → simplement loggé (Stalwart retentera).
 */
async function processDsnFailure(
  drizzle: NonNullable<ReturnType<typeof getDb>>,
  evt: StalwartWebhookEvent,
  outbox: { id: string; toEmail: string } | null,
): Promise<string> {
  const isPerm = evt.event === 'delivery.dsn-perm-fail';
  const evtTs = 'ts' in evt && typeof evt.ts === 'string' ? evt.ts : null;
  const ts = evtTs ? new Date(evtTs) : new Date();
  const reason =
    'reason' in evt && typeof evt.reason === 'string' && evt.reason.length > 0
      ? evt.reason
      : 'details' in evt && typeof (evt as Record<string, unknown>).details === 'string'
        ? ((evt as Record<string, unknown>).details as string)
        : 'dsn-failure';
  const rawJson = evt as unknown as Record<string, unknown>;

  if (outbox) {
    await drizzle
      .update(emailOutbox)
      .set({
        status: isPerm ? 'bounced_permanent' : 'bounced_soft',
        bouncedAt: ts,
        bounceReason: reason,
        bounceType: isPerm ? 'hard' : 'soft',
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, outbox.id));
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: isPerm ? 'bounced_hard' : 'bounced_soft',
      source: 'stalwart',
      ts,
      rawJson,
    });
    if (isPerm) {
      await drizzle
        .insert(emailSuppression)
        .values({ email: outbox.toEmail, reason: 'hard_bounce', detail: reason, source: 'stalwart' })
        .onConflictDoNothing();
    }
    return isPerm ? 'dsn-bounced-hard' : 'dsn-bounced-soft';
  }

  // Pas de ligne outbox (DSN sans messageId) : on extrait le destinataire de
  // l'event (`rcpt` ou `to`) et on supprime sur échec permanent.
  const rcpt = extractDsnRecipient(evt);
  if (isPerm && rcpt) {
    await drizzle
      .insert(emailSuppression)
      .values({ email: rcpt, reason: 'hard_bounce', detail: reason, source: 'stalwart' })
      .onConflictDoNothing();
    return 'dsn-suppressed-rcpt';
  }
  logger.info('mail.webhook.stalwart.dsn_unmatched', {
    stalwart_event: evt.event,
    has_rcpt: Boolean(rcpt),
  });
  return 'dsn-unmatched';
}

/** Extrait le 1er destinataire d'un event DSN (`rcpt` ou `to`, string ou array). */
function extractDsnRecipient(evt: StalwartWebhookEvent): string | null {
  const e = evt as Record<string, unknown>;
  for (const key of ['rcpt', 'to'] as const) {
    const v = e[key];
    if (typeof v === 'string' && v.includes('@')) return v;
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === 'string' && x.includes('@'));
      if (typeof first === 'string') return first;
    }
  }
  return null;
}
