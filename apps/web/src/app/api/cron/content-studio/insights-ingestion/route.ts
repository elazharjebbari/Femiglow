/**
 * S3.1 — Periodic ingestion of post performance snapshots.
 *
 * Recommended cadence: every 6 hours. The worker has a sliding window of
 * [now - 72h, now - 24h] so missing a tick is recoverable on the next one.
 *
 * Security: Bearer `CRON_SECRET`.
 */
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import { runInsightsIngestion } from '@/lib/content-studio/insights-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  try {
    authorizeCron(request);

    const summary = await runInsightsIngestion({ now: new Date() });

    logger.info('content.cron.insights_ingestion_ok', {
      scanned: summary.scanned,
      ingested: summary.ingested,
      skipped: summary.skipped,
      failed: summary.failed,
    });

    return NextResponse.json({
      ok: true,
      scanned: summary.scanned,
      ingested: summary.ingested,
      skipped: summary.skipped,
      failed: summary.failed,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

function authorizeCron(request: Request): void {
  const auth = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
  }
}
