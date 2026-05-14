/**
 * GET /api/admin/tracking/plans/audit?planId=…  → journal d'audit
 *
 * Si planId omis : retourne toutes les entrées (les plus récentes en premier).
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getTrackingPlanService } from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const planId = url.searchParams.get('planId') ?? undefined;

    const service = getTrackingPlanService();
    const entries = await service.history(planId);
    return NextResponse.json({ data: entries, total: entries.length });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
