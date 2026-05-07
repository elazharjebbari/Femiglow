/**
 * Cron — rafraîchissement des vues matérialisées analytics.
 * cf. docs/analytics/02-data-model.md §3 et docs/analytics/07-runbook-roadmap.md §4
 *
 * Schedule (vercel.json) : `*\/15 * * * *` (toutes les 15 min).
 * Auth : Bearer CRON_SECRET (cohérent avec /api/cron/tick et tracking-purge).
 */
import { NextResponse } from 'next/server';

import { refreshAllMatviews } from '@/lib/analytics/matviews';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }

    const startedAt = Date.now();
    const results = await refreshAllMatviews();
    const totalMs = Date.now() - startedAt;
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    logger.info('analytics.cron.refresh_completed', {
      total_ms: totalMs,
      ok: okCount,
      failed: failCount,
      results: results.map((r) => ({
        view: r.view,
        ok: r.ok,
        duration_ms: r.durationMs,
        concurrent: r.concurrent,
      })),
    });

    return NextResponse.json({
      ok: failCount === 0,
      total_ms: totalMs,
      results,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
