/**
 * GET /api/admin/analytics/insights/refresh — statut du dernier run.
 * POST /api/admin/analytics/insights/refresh — déclenche un refresh manuel.
 *
 * Auth : iron-session (admin) OU Bearer ${CRON_SECRET} (cron Vercel).
 *
 * cf. docs/analytics-insights/07-refresh-orchestration.md
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getInsightsRefreshStatus, runInsightsRefresh } from '@/lib/analytics/insights/refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const status = await getInsightsRefreshStatus();
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    const isCron = expected !== null && auth === expected;

    let actorId: string | null = null;
    let trigger: 'cron' | 'manual' = 'cron';

    if (isCron) {
      trigger = 'cron';
      actorId = null;
    } else {
      const session = await getAdminSession();
      if (!session) throw new HttpError('unauthorized', 'Session admin requise');
      trigger = 'manual';
      actorId = session.adminId;
    }

    try {
      const result = await runInsightsRefresh({ trigger, actorId });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof Error && (err as Error & { code?: string }).code === 'refresh_in_progress') {
        throw new HttpError('rate_limited', 'Un refresh est déjà en cours');
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
