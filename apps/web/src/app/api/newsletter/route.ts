import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailSchema } from '@/lib/schemas';
import { logger } from '@/lib/logging/logger';
import { env } from '@/lib/env';
import { sendTransactional } from '@/lib/mail/send';
import { generateUnsubToken } from '@/lib/mail/unsub-token';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const blocked = await enforceMailRateLimit('newsletter', request);
  if (blocked) return blocked;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée.', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { email, source } = parsed.data;

  logger.info('newsletter.subscription.received', {
    source: source ?? 'unknown',
  });

  // M1.B.1 — Double opt-in : envoyer un mail de confirmation.
  // Idempotency : pas de date dans la clé — re-soumettre le même email
  // dans une session répétée envoie un seul mail (l'utilisateur peut juste
  // re-cliquer son ancien lien).
  let confirmUrl: string;
  try {
    const token = generateUnsubToken(email); // re-use HMAC token signing
    confirmUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/newsletter/confirm?t=${encodeURIComponent(token)}`;
  } catch {
    // MAIL_UNSUB_TOKEN_SECRET not configured — log and reply ok anyway
    // (form succeeded, but confirm step won't happen until secret is set).
    logger.warn('newsletter.confirm_token_unavailable');
    return NextResponse.json({ ok: true });
  }

  void sendTransactional({
    template: 'newsletter-confirm',
    to: { email },
    payload: { confirmUrl },
    idempotencyKey: `newsletter-confirm:${email.toLowerCase()}`,
    source: `api.newsletter.${source ?? 'unknown'}`,
  }).catch((err: unknown) => {
    logger.error('mail.newsletter_confirm.dispatch_error', { error: String(err) });
  });

  return NextResponse.json({ ok: true });
}
