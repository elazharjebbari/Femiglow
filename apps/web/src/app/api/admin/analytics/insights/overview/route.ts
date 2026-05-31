/**
 * GET /api/admin/analytics/insights/overview
 * cf. docs/analytics-insights/03-backend.md §3.1
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseInsightsFiltersFromUrl } from '@/lib/analytics/insights/parse-filters';
import { getOverview } from '@/lib/analytics/insights/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const filters = parseInsightsFiltersFromUrl(new URL(request.url));
    const data = await getOverview(filters);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'X-Insights-Refreshed-At': data.refreshedAt ?? '',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
