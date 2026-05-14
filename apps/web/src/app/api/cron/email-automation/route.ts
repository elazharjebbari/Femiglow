/**
 * Cron endpoint — tick the automation runner.
 *
 * Called by femiglow-cron-email-automation.timer every 60s.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { tickAutomation } from '@/lib/mail/automation/runner';
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
    const result = await tickAutomation();
    logger.info('cron.email_automation.completed', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron.email_automation.crashed', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
