/**
 * GET /api/admin/analytics/insights/export?view=...
 * cf. docs/analytics-insights/08-filtres-exports.md §6
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logInsightsAudit } from '@/lib/analytics/insights/audit';
import { INSIGHTS_EXPORT_VIEWS, type InsightsExportView } from '@/lib/analytics/insights/contracts';
import { exportCsv } from '@/lib/analytics/insights/exports';
import { parseInsightsFiltersFromUrl } from '@/lib/analytics/insights/parse-filters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const viewParam = url.searchParams.get('view') ?? '';
    if (!INSIGHTS_EXPORT_VIEWS.includes(viewParam as InsightsExportView)) {
      throw new HttpError('invalid_input', `view invalide : ${viewParam}`);
    }
    const view = viewParam as InsightsExportView;
    const filters = parseInsightsFiltersFromUrl(url);

    const csv = await exportCsv(view, filters);

    await logInsightsAudit({
      action: 'analytics.insights.export',
      actorId: session.adminId,
      meta: { view, filters, rowCount: csv.rowCount },
    });

    return new NextResponse(csv.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csv.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
