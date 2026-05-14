/**
 * POST /api/admin/tracking/plans/[id]/archive → archive un plan
 *
 * Réponses :
 * - 200 plan archivé
 * - 404 plan introuvable
 * - 400 plan_already_archived
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getTrackingPlanService } from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const { id } = await Promise.resolve(ctx.params);
    const service = getTrackingPlanService();

    try {
      const plan = await service.archive(id, session.email);
      return NextResponse.json(plan);
    } catch (err) {
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', `Plan "${id}" introuvable.`);
      }
      if (err instanceof Error && err.message === 'plan_already_archived') {
        throw new HttpError('invalid_input', 'Plan déjà archivé.');
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
