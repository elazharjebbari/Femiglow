/**
 * GET /api/admin/tracking/plans/diff?a=<id>&b=<id> → ChangeSet entre deux plans
 *
 * Réponses :
 * - 200 ChangeSet
 * - 400 paramètres manquants
 * - 404 plan introuvable
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
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (!a || !b) {
      throw new HttpError('invalid_input', 'Paramètres a et b requis.');
    }

    const service = getTrackingPlanService();
    try {
      const changeset = await service.diff(a, b);
      return NextResponse.json(changeset);
    } catch (err) {
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', 'Un des plans est introuvable.');
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
