/**
 * POST /api/cron/email-audience-purge — purge snapshots > 90j (M5.3.10).
 *
 * Auth : Bearer CRON_SECRET (constant-time compare).
 * Idempotent : safe à exécuter plusieurs fois par jour.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { purgeExpiredSnapshots } from '@/lib/mail/audiences/purge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice(7);
  const expected = env.CRON_SECRET;
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await purgeExpiredSnapshots();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('cron.email-audience-purge.failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
