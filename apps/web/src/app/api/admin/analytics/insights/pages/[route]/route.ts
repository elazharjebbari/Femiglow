/**
 * GET /api/admin/analytics/insights/pages/[route] — drill-down page.
 * Note : `route` est URL-encodé (ex : %2Fkit pour /kit).
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseInsightsFiltersFromUrl } from '@/lib/analytics/insights/parse-filters';
import { getPageDetail } from '@/lib/analytics/insights/services';
import { logInsightsAudit } from '@/lib/analytics/insights/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { route: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const filters = parseInsightsFiltersFromUrl(new URL(request.url));
    const route = decodeURIComponent(params.route);
    const data = await getPageDetail(route, filters);
    if (data.pageViews === 0 && data.events.length === 0) {
      throw new HttpError('not_found', 'Aucune donnée pour cette page');
    }
    await logInsightsAudit({
      action: 'analytics.insights.drilldown.page',
      actorId: session.adminId,
      meta: { pageRoute: route },
    });
    return NextResponse.json(data);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
