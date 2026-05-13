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
import { db } from '@/lib/db/client';
import {
  emailOutbox,
  emailEvent,
  emailSuppression,
} from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import {
  stalwartWebhookSchema,
  isHardBounce,
  type StalwartWebhookEvent,
} from '@/lib/mail/webhooks/stalwart-parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = env.FEMIGLOW_STALWART_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('mail.webhook.stalwart.no_secret_configured');
    return new NextResponse('Webhook not configured', { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!constantTimeEqual(auth, expected)) {
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

  if (evt.event === 'auth.failure') {
    logger.warn('mail.smtp.auth_failure', { user: evt.user, ip: evt.ip });
    return NextResponse.json({ ok: true });
  }

  // All other events have messageId — lookup outbox.
  const found = await db
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.smtpMessageId, evt.messageId))
    .limit(1);

  if (found.length === 0) {
    // May be a message originating from Listmonk (uses its own Message-ID
    // namespace) ; that path is handled via the Listmonk webhook.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const outbox = found[0];
  const ts = new Date(evt.ts);

  if (evt.event === 'message.queued') {
    await db.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'queued',
      source: 'stalwart',
      ts,
      rawJson: evt as unknown as Record<string, unknown>,
    });
  } else if (evt.event === 'message.delivered') {
    await db
      .update(emailOutbox)
      .set({ status: 'delivered', deliveredAt: ts, updatedAt: new Date() })
      .where(eq(emailOutbox.id, outbox.id));
    await db.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'delivered',
      source: 'stalwart',
      ts,
      rawJson: evt as unknown as Record<string, unknown>,
    });
  } else if (evt.event === 'message.delivery-failed') {
    const isHard = isHardBounce(evt.errorCode);
    await db
      .update(emailOutbox)
      .set({
        status: isHard ? 'bounced_permanent' : 'bounced_soft',
        bouncedAt: ts,
        bounceReason: evt.reason,
        bounceType: isHard ? 'hard' : 'soft',
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, outbox.id));
    await db.insert(emailEvent).values({
      outboxId: outbox.id,
      type: isHard ? 'bounced_hard' : 'bounced_soft',
      source: 'stalwart',
      ts,
      rawJson: evt as unknown as Record<string, unknown>,
    });
    if (isHard) {
      await db
        .insert(emailSuppression)
        .values({
          email: outbox.toEmail,
          reason: 'hard_bounce',
          detail: evt.reason,
          source: 'stalwart',
        })
        .onConflictDoNothing();
    }
  } else if (evt.event === 'message.delivery-deferred') {
    await db.insert(emailEvent).values({
      outboxId: outbox.id,
      type: 'retried',
      source: 'stalwart',
      ts,
      rawJson: evt as unknown as Record<string, unknown>,
    });
  }

  return NextResponse.json({ ok: true });
}
