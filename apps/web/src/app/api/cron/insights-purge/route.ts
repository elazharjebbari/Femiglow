/**
 * Cron Vercel — purge des tables `insights_*` selon la retention.
 * Schedule (vercel.json) : `30 3 1 * *` (1er du mois à 3h30)
 * Auth : Bearer ${CRON_SECRET}
 *
 * cf. docs/analytics-insights/02-data.md §10
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { purgeInsights } from '@/lib/analytics/insights/purge';
import { logInsightsAudit } from '@/lib/analytics/insights/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }

    const result = await purgeInsights();

    logger.info('insights.purge.completed', {
      cutoff_dates: result.cutoffDates,
      purged: result.purged,
    });

    await logInsightsAudit({
      action: 'analytics.insights.purge',
      actorId: null,
      meta: { cutoffDates: result.cutoffDates, purged: result.purged },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export const GET = handle;
export const POST = handle;
