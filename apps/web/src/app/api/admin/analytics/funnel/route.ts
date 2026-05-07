/**
 * GET /api/admin/analytics/funnel
 * Onglet Funnel — overview (5 steps + drop-offs) et data-table par page d'entrée.
 * cf. docs/analytics/05-onglets-specs.md §3
 *
 * Query params : period, device, traffic, from?, to? (cf. AnalyticsFiltersSchema).
 * Optionnel `view=table` → renvoie la DataTable au lieu du funnel global.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import {
  getFunnelByPage,
  getFunnelOverview,
} from '@/lib/analytics/queries/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const filters = parseFiltersFromSearchParams(url.searchParams);
    const view = url.searchParams.get('view');

    const data =
      view === 'table'
        ? await getFunnelByPage(filters)
        : await getFunnelOverview(filters);

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
