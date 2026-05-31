import { NextResponse } from 'next/server';
import { RitualTestimonialSubmitSchema } from '@/lib/schemas/rituals';
import { submitRitual } from '@/lib/rituals/submit-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate-limit léger en mémoire (single-instance) — production : remplacer par
// lib/rate-limit dédié + storage Redis si scale-out.
const submissionsByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h
const LIMIT_PER_IP = 1;

function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const current = submissionsByIp.get(ip);
  if (!current || current.resetAt < now) {
    submissionsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT_PER_IP) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMIT',
          message: 'La maison a déjà reçu votre voix récemment.',
        },
      },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'JSON invalide' } },
      { status: 400 },
    );
  }

  const parsed = RitualTestimonialSubmitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Quelques mots de plus aideront d’autres initiées.',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitRitual(parsed.data, { ip });
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (e) {
    console.error('[rituals/submit] error', e);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL',
          message:
            'La maison n’a pas pu recevoir votre rituel. Essayez à nouveau dans quelques minutes.',
        },
      },
      { status: 500 },
    );
  }
}
