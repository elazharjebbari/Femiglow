/**
 * GET /api/admin/analytics/insights/components — top + dead.
 * Query params : limit (default 50), dead (true/false)
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseInsightsFiltersFromUrl } from '@/lib/analytics/insights/parse-filters';
import { getComponentsTop, getDeadComponents } from '@/lib/analytics/insights/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const filters = parseInsightsFiltersFromUrl(url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 50) || 50));

    const [top, dead] = await Promise.all([
      getComponentsTop(filters, limit),
      getDeadComponents(filters),
    ]);

    return NextResponse.json(
      { ...top, dead: dead.components },
      {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
      },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
