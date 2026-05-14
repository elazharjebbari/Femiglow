/**
 * POST /api/cron/email-listmonk-cleanup — purge listes Listmonk éphémères
 * dont le snapshot FemiGlow est expiré (M5.4).
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { cleanupExpiredListmonkLists } from '@/lib/mail/campaigns/listmonk-sync';

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
    const result = await cleanupExpiredListmonkLists();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('cron.email-listmonk-cleanup.failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
