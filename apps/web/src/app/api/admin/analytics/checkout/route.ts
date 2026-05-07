/**
 * GET /api/admin/analytics/checkout
 * Onglet Checkout — KPI globaux + funnel 6 étapes + time-to-submit + erreurs
 * formulaire + champs abandonnés.
 * cf. docs/analytics/05-onglets-specs.md §5
 *
 * Query params : period, device, traffic, from?, to? (cf. AnalyticsFiltersSchema).
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import { getCheckoutData } from '@/lib/analytics/queries/checkout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const filters = parseFiltersFromSearchParams(url.searchParams);
    const data = await getCheckoutData(filters);

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
