import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailSchema } from '@/lib/schemas';

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

  // Phase 2 : intégration Resend Audiences ou Mailjet.
  console.warn('[newsletter] inscription', {
    email: parsed.data.email,
    source: parsed.data.source ?? 'unknown',
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
