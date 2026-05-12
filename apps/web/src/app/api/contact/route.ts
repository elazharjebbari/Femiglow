import { NextResponse } from 'next/server';
import { contactFormSchema } from '@/lib/schemas';
import { logger } from '@/lib/logging/logger';
import { dispatchContactWebhook } from '@/lib/webhooks/outbound/sources/from-contact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  return NextResponse.json({ ok: true });
}
