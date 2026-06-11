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
import { db as getDb } from '@/lib/db/client';
import { OUTBOX_CRON_NAME, recordCronHeartbeat } from '@/lib/admin/emails/cron-heartbeat';

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
    // Heartbeat (F-002) — on persiste un tick à CHAQUE exécution réussie, même
    // sur file vide (picked=0). C'est ce marqueur que le health check lit pour
    // distinguer « cron vivant, rien à faire » de « cron mort ». Best-effort :
    // un échec d'écriture du heartbeat ne doit pas faire échouer le drain.
    const drizzle = getDb();
    if (drizzle) {
      try {
        await recordCronHeartbeat(drizzle, OUTBOX_CRON_NAME, {
          processed: result.picked,
          succeeded: result.succeeded,
          failed: result.failed,
        });
      } catch (hbErr) {
        logger.error('cron.email_outbox.heartbeat_failed', {
          error: hbErr instanceof Error ? hbErr.message : String(hbErr),
        });
      }
    }
    logger.info('cron.email_outbox.completed', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('cron.email_outbox.crashed', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
