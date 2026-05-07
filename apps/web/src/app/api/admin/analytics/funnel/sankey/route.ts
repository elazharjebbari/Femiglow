/**
 * GET /api/admin/analytics/funnel/sankey
 * Flux first_page → step max atteint, top 20.
 * cf. docs/analytics/05-onglets-specs.md §3.5
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import { getFunnelSankey } from '@/lib/analytics/queries/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const filters = parseFiltersFromSearchParams(url.searchParams);
    const data = await getFunnelSankey(filters);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
