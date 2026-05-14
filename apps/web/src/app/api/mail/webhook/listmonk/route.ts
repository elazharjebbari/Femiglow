/**
 * Listmonk → FemiGlow webhook receiver.
 *
 * Auth : HMAC-SHA256 over the raw body, sent via X-Listmonk-Signature
 *        header (Listmonk's default scheme).
 *
 * For now we only log the event ; the schema (email_event,
 * email_subscriber_link, email_campaign_link) is in place but the wiring
 * to UPDATE these tables happens in M3.4 when we sync campaign metrics
 * back to FemiGlow's admin dashboard.
 *
 * Cf. docs/emailing/03-backend-integration.md §5
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import {
  listmonkWebhookSchema,
  isKnownListmonkEvent,
} from '@/lib/mail/webhooks/listmonk-parser';
import { dispatchListmonkEvent } from '@/lib/mail/webhooks/listmonk-dispatcher';
import { bridgeListmonkToUserEvent } from '@/lib/user-events/bridges/email-webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyHmac(rawBody: string, providedSig: string, secret: string): boolean {
  // Listmonk sends "sha256=<hex>" or just "<hex>" depending on version.
  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = providedSig.startsWith('sha256=') ? providedSig.slice(7) : providedSig;
  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = env.LISTMONK_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('mail.webhook.listmonk.no_secret_configured');
    return new NextResponse('Webhook not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('x-listmonk-signature') ?? '';
  if (!sig || !verifyHmac(rawBody, sig, secret)) {
    logger.warn('mail.webhook.listmonk.bad_signature', { providedSig: sig.slice(0, 16) });
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 });
  }

  const parsed = listmonkWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('mail.webhook.listmonk.bad_payload', { issues: parsed.error.issues });
    return new NextResponse('Bad payload', { status: 400 });
  }

  const evt = parsed.data;
  logger.info('mail.webhook.listmonk.received', { event: evt.event });

  if (!isKnownListmonkEvent(evt)) {
    return NextResponse.json({ ok: true, ignored: 'unknown-event' });
  }

  try {
    await dispatchListmonkEvent(evt);
  } catch (err) {
    logger.error('mail.webhook.listmonk.dispatch_error', {
      event: evt.event,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't fail the webhook — return 200 so Listmonk doesn't retry-storm.
    // The error is logged and surfacable via Sentry / observability.
  }

  // M5.2 — bridge vers user_event (unified). Fire-and-forget. Extraction
  // de l'email best-effort depuis le payload, qui contient soit
  // data.subscriber.email soit data.email selon l'event Listmonk.
  void (async () => {
    const data = (evt as { data?: Record<string, unknown> }).data ?? {};
    const sub = (data.subscriber ?? data) as Record<string, unknown>;
    const email = typeof sub.email === 'string' ? sub.email : null;
    const evtName = evt.event;
    if (!email) return;
    if (
      evtName === 'subscriber.created' ||
      evtName === 'subscriber.unsubscribed' ||
      evtName === 'subscriber.bounced' ||
      evtName === 'subscriber.complained'
    ) {
      const bounceType =
        evtName === 'subscriber.bounced' && typeof data.bounce_type === 'string'
          ? data.bounce_type
          : undefined;
      await bridgeListmonkToUserEvent({
        event: evtName,
        email,
        bounceType,
      });
    }
  })();

  return NextResponse.json({ ok: true });
}
