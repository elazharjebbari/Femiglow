/**
 * OWBS — Cron endpoint : draine `lead_event_outbox` (effets durables des leads).
 *
 * Scheduled par l'unit systemd `femiglow-cron-lead-outbox.timer` (~60 s).
 * Idempotent : `FOR UPDATE SKIP LOCKED` → workers concurrents non bloquants.
 * Calqué sur `/api/cron/email-outbox`.
 *
 * @see docs/checkout-leads-background-2026-06-01/05-runbook/runbook.md §3
 */
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { pickAndProcessBatch } from '@/lib/leads/outbox/lead-outbox-processor';

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
    logger.info('cron.lead_outbox.completed', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron.lead_outbox.crashed', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
