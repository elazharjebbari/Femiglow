import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { purgeEventsBefore } from '@/lib/db/queries/tracking/events-log';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RETENTION_DAYS = 180;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const purged = await purgeEventsBefore(cutoff);

    logger.info('tracking.purge.completed', {
      retention_days: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      purged,
    });

    await auditTrackingChange({
      action: 'purge',
      resource: 'tracking_inventory',
      actorId: null,
      meta: { retention_days: RETENTION_DAYS, cutoff: cutoff.toISOString(), purged },
    });

    return NextResponse.json({ ok: true, purged, cutoff: cutoff.toISOString() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
