/**
 * GET /api/admin/tracking/plans/defaults → valeurs auto-prefill (IDs par défaut)
 *
 * Utilisé par le wizard pour pré-remplir GA4 / Ads / Meta / GTM.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getTrackingPlanService } from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const service = getTrackingPlanService();
    const defaults = await service.defaults();
    return NextResponse.json({ data: defaults });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
