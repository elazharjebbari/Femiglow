/**
 * GET    /api/admin/seo/[id]      → détail
 * PATCH  /api/admin/seo/[id]      → maj draft (revalidate seulement après publish)
 * DELETE /api/admin/seo/[id]      → suppression (RBAC editor+ requis)
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  deleteOverride,
  getOverrideById,
  upsertOverride,
} from '@/lib/db/queries/seo';
import { seoOverridePatchSchema } from '@/lib/seo/schemas';
import { SEO_TAG, seoTargetTag } from '@/lib/seo/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const override = await getOverrideById(params.id);
    if (!override) throw new HttpError('not_found', 'Override introuvable.');
    return NextResponse.json({ override });
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
    const params = await Promise.resolve(ctx.params);
    const existing = await getOverrideById(params.id);
    if (!existing) throw new HttpError('not_found', 'Override introuvable.');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = seoOverridePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const updated = await upsertOverride({
      id: existing.id,
      scope: existing.scope,
      targetKey: existing.targetKey,
      locale: existing.locale,
      ...parsed.data,
      actorId: session.adminId,
    });

    await logAuditEvent({
      action: 'seo.update',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: updated.id,
      meta: { scope: updated.scope, targetKey: updated.targetKey, fields: Object.keys(parsed.data) },
    });

    return NextResponse.json({ override: updated });
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
    const params = await Promise.resolve(ctx.params);
    const existing = await getOverrideById(params.id);
    if (!existing) throw new HttpError('not_found', 'Override introuvable.');
    const ok = await deleteOverride(params.id);
    if (!ok) throw new HttpError('internal_error', 'Suppression échouée.');
    revalidateTag(SEO_TAG);
    revalidateTag(seoTargetTag(existing.scope, existing.targetKey));
    if (existing.scope === 'product' && existing.targetKey === 'le-kit') {
      revalidatePath('/kit');
    }
    await logAuditEvent({
      action: 'seo.delete',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: params.id,
      meta: { scope: existing.scope, targetKey: existing.targetKey },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
