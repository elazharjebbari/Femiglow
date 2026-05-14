/**
 * POST /api/admin/tracking/plans/[id]/restore → archived → draft.
 *
 * Réponses :
 * - 200 plan restauré en brouillon (version + 1, audit `restore`).
 * - 404 plan absent.
 * - 400 plan_not_archived (statut courant n'est pas `archived`).
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
      const plan = await service.restore(id, session.email);
      return NextResponse.json(plan);
    } catch (err) {
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', `Plan "${id}" introuvable.`);
      }
      if (err instanceof Error && err.message === 'plan_not_archived') {
        throw new HttpError(
          'invalid_input',
          'Seuls les plans archivés peuvent être restaurés en brouillon.',
        );
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
