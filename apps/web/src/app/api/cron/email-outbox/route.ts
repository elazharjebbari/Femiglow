/**
 * Cron endpoint — pickup batch from email_outbox and attempt delivery.
 *
 * Scheduled by systemd unit `femiglow-cron-email-outbox.timer` (every 60s).
 * Idempotent : `FOR UPDATE SKIP LOCKED` so concurrent runners don't collide.
 *
 * Cf. docs/emailing/03-backend-integration.md §3.6.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { pickAndProcessBatch } from '@/lib/mail/outbox';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await pickAndProcessBatch();
    logger.info('cron.email_outbox.completed', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron.email_outbox.crashed', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
