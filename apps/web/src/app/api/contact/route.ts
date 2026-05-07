import { NextResponse } from 'next/server';
import { contactFormSchema } from '@/lib/schemas';

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

  console.warn('[contact] message reçu', {
    email: parsed.data.email,
    type: parsed.data.type,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
