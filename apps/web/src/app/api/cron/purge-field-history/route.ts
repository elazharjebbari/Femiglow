/**
 * GET/POST /api/cron/purge-field-history
 *
 * Supprime les entrées de `component_field_history` plus anciennes que
 * `RETENTION_DAYS`. Pour chaque binding, on conserve **au moins** sa
 * dernière entrée (cf. `purgeFieldHistoryBefore`).
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P10.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { purgeFieldHistoryBefore } from '@/lib/db/queries/component-fields';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RETENTION_DAYS = 365;

async function handle(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }
    const start = Date.now();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const purged = await purgeFieldHistoryBefore(cutoff);

    const durationMs = Date.now() - start;
    logger.info('cron.purge_field_history.completed', {
      retention_days: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      purged,
      duration_ms: durationMs,
    });

    if (purged > 0) {
      await logAuditEvent({
        action: 'system.cron_purge_field_history',
        actorId: null,
        meta: {
          retention_days: RETENTION_DAYS,
          cutoff: cutoff.toISOString(),
          purged,
        },
      });
    }

    return NextResponse.json({ ok: true, purged, cutoff: cutoff.toISOString() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
