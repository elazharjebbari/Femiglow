/**
 * GET /api/admin/tracking/plans/[id]/export?env=production → export GTM déterministe
 *
 * Réponses :
 * - 200 ExportResult { container, bundleId, generatedAt, env }
 * - 404 plan introuvable
 * - 422 plan invalide (export refusé tant que la validation échoue)
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getTrackingPlanService,
  ValidationFailedError,
  type EnvName,
} from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ENV: readonly EnvName[] = ['production', 'staging', 'local'];

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const { id } = await Promise.resolve(ctx.params);
    const url = new URL(request.url);
    const envParam = (url.searchParams.get('env') ?? 'production') as EnvName;
    if (!ALLOWED_ENV.includes(envParam)) {
      throw new HttpError('invalid_input', `env doit être l'un de ${ALLOWED_ENV.join(', ')}.`);
    }

    const service = getTrackingPlanService();
    try {
      const result = await service.export(id, envParam);
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof ValidationFailedError) {
        throw new HttpError('validation_failed', 'Plan invalide, export refusé.', {
          errors: err.result.errors,
          warnings: err.result.warnings,
        });
      }
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
