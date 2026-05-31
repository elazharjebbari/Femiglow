/**
 * GET /api/admin/analytics/insights/components/[id] — drill-down composant.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseInsightsFiltersFromUrl } from '@/lib/analytics/insights/parse-filters';
import { getComponentDetail } from '@/lib/analytics/insights/services';
import { logInsightsAudit } from '@/lib/analytics/insights/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const filters = parseInsightsFiltersFromUrl(new URL(request.url));
    const data = await getComponentDetail(params.id, filters);
    if (data.total === 0) {
      throw new HttpError('not_found', 'Aucune donnée pour ce composant');
    }
    await logInsightsAudit({
      action: 'analytics.insights.drilldown.component',
      actorId: session.adminId,
      meta: { componentId: params.id },
    });
    return NextResponse.json(data);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
