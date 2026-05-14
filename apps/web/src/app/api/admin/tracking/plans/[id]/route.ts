/**
 * GET    /api/admin/tracking/plans/[id]  → plan détaillé
 * PATCH  /api/admin/tracking/plans/[id]  → update optimistic-concurrency (header If-Match: version)
 * DELETE /api/admin/tracking/plans/[id]  → suppression définitive (drafts + archived uniquement)
 *
 * Réponses :
 * - 404 si plan absent
 * - 409 conflit version (header If-Match obsolète)
 * - 422 validation Zod
 * - 400 si tentative de DELETE sur un plan actif
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getTrackingPlanService,
  trackingPlanInputSchema,
  VersionConflictError,
} from '@/lib/tracking/plan';

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
    const plan = await service.get(id);
    if (!plan) throw new HttpError('not_found', `Plan "${id}" introuvable.`);
    return NextResponse.json(plan);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const { id } = await Promise.resolve(ctx.params);
    const ifMatch = request.headers.get('if-match');
    if (!ifMatch) {
      throw new HttpError('invalid_input', 'Header If-Match requis.');
    }
    const expectedVersion = Number.parseInt(ifMatch, 10);
    if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
      throw new HttpError('invalid_input', 'If-Match doit être un entier ≥ 1.');
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }

    const parsed = trackingPlanInputSchema.partial().safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('validation_failed', 'Données invalides.', {
        issues: parsed.error.issues,
      });
    }

    const service = getTrackingPlanService();
    try {
      const plan = await service.update(id, parsed.data, expectedVersion, session.email);
      return NextResponse.json(plan);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        throw new HttpError('version_conflict', err.message, {
          currentVersion: err.currentVersion,
          attemptedVersion: err.attemptedVersion,
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

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const { id } = await Promise.resolve(ctx.params);
    const service = getTrackingPlanService();

    try {
      await service.delete(id, session.email);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof Error && err.message === 'plan_not_found') {
        throw new HttpError('not_found', `Plan "${id}" introuvable.`);
      }
      if (err instanceof Error && err.message === 'plan_active_cannot_delete') {
        throw new HttpError(
          'invalid_input',
          'Impossible de supprimer un plan actif. Archivez-le d\u2019abord.',
        );
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
