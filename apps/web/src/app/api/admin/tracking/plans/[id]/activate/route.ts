/**
 * POST /api/admin/tracking/plans/[id]/activate → active un plan (validation préalable obligatoire)
 *
 * Réponses :
 * - 200 plan activé (ancien actif → archived dans la même transaction)
 * - 404 plan introuvable
 * - 422 validation_failed (issues retournés)
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getTrackingPlanService,
  ValidationFailedError,
} from '@/lib/tracking/plan';

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
      const plan = await service.activate(id, session.email);
      return NextResponse.json(plan);
    } catch (err) {
      if (err instanceof ValidationFailedError) {
        throw new HttpError('validation_failed', 'Plan invalide, activation refusée.', {
          errors: err.result.errors,
          warnings: err.result.warnings,
        });
      }
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', `Plan "${id}" introuvable.`);
      }
      if (err instanceof Error && err.message === 'plan_already_active') {
        throw new HttpError('invalid_input', 'Plan déjà actif.');
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
