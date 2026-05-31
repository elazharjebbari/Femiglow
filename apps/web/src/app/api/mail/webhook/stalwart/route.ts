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
import { eq } from 'drizzle-orm';

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
  stalwartWebhookSchema,
  isHardBounce,
  isKnownEvent,
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

  const parsed = stalwartWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('mail.webhook.stalwart.bad_payload', { issues: parsed.error.issues });
    return new NextResponse('Bad payload', { status: 400 });
  }

  const evt: StalwartWebhookEvent = parsed.data;
  logger.info('mail.webhook.stalwart.received', { event: evt.event });

  if (!isKnownEvent(evt)) {
    // Stalwart's webhook captures all events (eventsPolicy=exclude + events={}).
    // Most are noise for our use case (acme.*, dns.*, imap.*, etc.) — silently
    // return 200 so Stalwart doesn't keep retrying.
    return NextResponse.json({ ok: true, ignored: 'unhandled-event' });
  }

  if (evt.event === 'auth.failed') {
    logger.warn('mail.smtp.auth_failed', { user: evt.user, ip: evt.ip });
    return NextResponse.json({ ok: true });
  }

  // All remaining events should carry a messageId — but Stalwart's exact
  // payload shape isn't fully documented, so guard against absent fields.
  const messageId =
    'messageId' in evt && typeof evt.messageId === 'string' ? evt.messageId : null;
  if (!messageId) {
    logger.info('mail.webhook.stalwart.no_message_id', { event: evt.event });
    return NextResponse.json({ ok: true, ignored: 'no-message-id' });
  }

  const drizzle = getDb();
  if (!drizzle) {
    logger.warn('mail.webhook.stalwart.db_not_configured');
    return NextResponse.json({ ok: false, error: 'db-not-configured' }, { status: 503 });
  }
  const found = await drizzle
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.smtpMessageId, messageId))
    .limit(1);

  if (found.length === 0 || !found[0]) {
    // May be a message originating from Listmonk (uses its own Message-ID
    // namespace) ; that path is handled via the Listmonk webhook.
    return NextResponse.json({ ok: true, ignored: 'unknown-message-id' });
  }

  const outbox = found[0];
  const evtTs = 'ts' in evt && typeof evt.ts === 'string' ? evt.ts : null;
  const ts = evtTs ? new Date(evtTs) : new Date();
  const rawJson = evt as unknown as Record<string, unknown>;

  if (evt.event === 'queue.message-queued' || evt.event === 'queue.authenticated-message-queued') {
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'queued',
      source: 'stalwart',
      ts,
      rawJson,
    });
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
  } else if (evt.event === 'queue.rescheduled') {
    await drizzle.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'retried',
      source: 'stalwart',
      ts,
      rawJson,
    });
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

  return NextResponse.json({ ok: true });
}
