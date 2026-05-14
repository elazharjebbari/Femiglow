/**
 * GET /api/admin/tracking/plans/[id]/validate → exécute les règles R-001..R-005
 *
 * Réponses :
 * - 200 ValidationResult { ok, errors, warnings }
 * - 404 plan introuvable
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getTrackingPlanService } from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const { id } = await Promise.resolve(ctx.params);
    const service = getTrackingPlanService();

    try {
      const result = await service.validate(id);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', `Plan "${id}" introuvable.`);
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
