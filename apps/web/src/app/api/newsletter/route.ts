import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailSchema } from '@/lib/schemas';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true),
  source: z.string().max(60).optional(),
});

export async function POST(request: Request) {
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

  // CHA-260 — La newsletter n'a PAS de téléphone : par contrat phone-gate
  // (cf. runbook §2.5), aucun webhook outbound n'est déclenché. La
  // synchronisation vers Resend/Mailjet reste prévue côté job dédié.
  logger.info('newsletter.subscription.received', {
    source: parsed.data.source ?? 'unknown',
  });

  return NextResponse.json({ ok: true });
}
