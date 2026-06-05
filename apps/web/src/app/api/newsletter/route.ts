import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailSchema } from '@/lib/schemas';
import { logger } from '@/lib/logging/logger';
import { triggerNewsletterDoubleOptIn } from '@/lib/mail/newsletter-optin';
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

  // M1.B.1 — Double opt-in : envoyer un mail de confirmation (flux partagé
  // avec /api/contact, cf. lib/mail/newsletter-optin).
  const result = triggerNewsletterDoubleOptIn({
    email,
    source: source ?? 'unknown',
  });

  // UX-PUB-007 — si le secret de signature manque, AUCUN mail de confirmation
  // ne peut partir. On renvoie une erreur 503 actionnable plutôt qu'un faux
  // `ok:true` qui ferait afficher « Bienvenue » sans qu'aucun email ne parte.
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          'Service d’inscription momentanément indisponible. Réessayez dans quelques minutes.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
