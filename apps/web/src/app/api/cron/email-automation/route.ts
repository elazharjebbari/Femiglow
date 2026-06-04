/**
 * Cron endpoint — tick the automation runner.
 *
 * Called by femiglow-cron-email-automation.timer every 60s.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { tickAutomation } from '@/lib/mail/automation/runner';
import { sweepWaitForEventTimeouts } from '@/lib/mail/automation/resume';
import { dispatchEventTriggers } from '@/lib/mail/automation/event-dispatcher';
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
    // 1.7 — enrôle les runs depuis les user_event matchant les triggers
    // (triggerType/triggerConfig désormais lus par le runtime).
    const dispatch = await dispatchEventTriggers();
    // M5.5 — sweep wait_for_event timeouts before picking up runs.
    const sweptTimeouts = await sweepWaitForEventTimeouts();
    // 1.4 — le sweep des orphelins est intégré au tick (avant le claim).
    const result = await tickAutomation();
    logger.info('cron.email_automation.completed', {
      ...result,
      sweptTimeouts,
      dispatched: dispatch.enrolled,
    });
    return NextResponse.json({ ok: true, ...result, sweptTimeouts, dispatch });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron.email_automation.crashed', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
