/**
 * GET / PATCH /api/admin/analytics/insights/settings
 *
 * - GET : renvoie { enabled, intervalMinutes, lastRun }
 * - PATCH : met à jour `enabled` et/ou `intervalMinutes`
 *
 * cf. docs/analytics-insights/07-refresh-orchestration.md §9
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logInsightsAudit } from '@/lib/analytics/insights/audit';
import { insightsSettingsPatchSchema } from '@/lib/analytics/insights/contracts';
import { getInsightsRefreshStatus } from '@/lib/analytics/insights/refresh';
import {
  setInsightsRefreshEnabled,
  setInsightsRefreshInterval,
  getInsightsRefreshEnabled,
  getInsightsRefreshInterval,
} from '@/lib/analytics/insights/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session admin requise');
    const status = await getInsightsRefreshStatus();
    return NextResponse.json(status);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session admin requise');

    const json = await request.json().catch(() => ({}));
    const parsed = insightsSettingsPatchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Patch invalide', parsed.error.issues);
    }

    const before = {
      enabled: await getInsightsRefreshEnabled(),
      intervalMinutes: await getInsightsRefreshInterval(),
    };

    if (parsed.data.enabled !== undefined) {
      await setInsightsRefreshEnabled(parsed.data.enabled, { actorId: session.adminId });
    }
    if (parsed.data.intervalMinutes !== undefined) {
      await setInsightsRefreshInterval(parsed.data.intervalMinutes, {
        actorId: session.adminId,
      });
    }

    const after = {
      enabled: await getInsightsRefreshEnabled(),
      intervalMinutes: await getInsightsRefreshInterval(),
    };

    await logInsightsAudit({
      action:
        parsed.data.enabled !== undefined
          ? 'analytics.insights.toggle'
          : 'analytics.insights.settings_update',
      actorId: session.adminId,
      meta: { before, after, patch: parsed.data },
    });

    const status = await getInsightsRefreshStatus();
    return NextResponse.json(status);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
