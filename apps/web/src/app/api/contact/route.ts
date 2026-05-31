import { NextResponse } from 'next/server';
import { contactFormSchema } from '@/lib/schemas';
import { logger } from '@/lib/logging/logger';
import { dispatchContactWebhook } from '@/lib/webhooks/outbound/sources/from-contact';
import { sendTransactional } from '@/lib/mail/send';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';
import { recordContactSubmitted } from '@/lib/user-events/bridges/server-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const blocked = await enforceMailRateLimit('contact', request);
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'website' in payload &&
    typeof (payload as { website?: unknown }).website === 'string' &&
    (payload as { website: string }).website.length > 0
  ) {
    return NextResponse.json({ ok: true });
  }

  const parsed = contactFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée.', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;

  logger.info('contact.message.received', {
    type: data.type,
    hasPhone: Boolean(data.phone?.trim()),
  });

  // M5.2 — bridge vers user_event (unified). Fire-and-forget.
  void recordContactSubmitted({
    email: data.email,
    contactType: data.type,
    hasPhone: Boolean(data.phone?.trim()),
  });

  // CHA-260 — Webhook outbound (fire-and-forget). Le dispatcher gère
  // phone-gate + log DB. On ne bloque pas la réponse client.
  void dispatchContactWebhook({
    type: data.type,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    orderNumber: data.orderNumber ?? null,
    companyName: data.companyName ?? null,
    role: data.role ?? null,
    message: data.message,
    newsletterOptIn: data.newsletterOptIn,
    ip,
  }).catch((err: unknown) => {
    logger.error('outbound.webhook.contact.dispatch_error', {
      error: String(err),
    });
  });

  // M1.A — Accusé de contact transactionnel (fire-and-forget aussi).
  // Idempotency key : email + jour, évite les doublons si le user re-soumet
  // 2× dans la même journée.
  const today = new Date().toISOString().slice(0, 10);
  const firstName = data.name.trim().split(/\s+/)[0] ?? data.name;
  void sendTransactional({
    template: 'contact-acknowledgement',
    to: { email: data.email, name: data.name },
    payload: {
      firstName,
      messageExcerpt: data.message.slice(0, 280),
    },
    idempotencyKey: `contact-ack:${data.email.toLowerCase()}:${today}`,
    source: 'api.contact',
  }).catch((err: unknown) => {
    logger.error('mail.contact_ack.dispatch_error', { error: String(err) });
  });

  return NextResponse.json({ ok: true });
}
