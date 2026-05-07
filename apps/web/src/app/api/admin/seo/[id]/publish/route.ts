/**
 * POST /api/admin/seo/[id]/publish — publie l'override (snapshot + revalidate + audit).
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { publishOverride } from '@/lib/db/queries/seo';
import { SEO_TAG, seoTargetTag } from '@/lib/seo/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const result = await publishOverride(params.id, session.adminId);
    if (!result) throw new HttpError('not_found', 'Override introuvable.');

    revalidateTag(SEO_TAG);
    revalidateTag(seoTargetTag(result.override.scope, result.override.targetKey));
    if (
      result.override.scope === 'product' &&
      result.override.targetKey === 'le-kit'
    ) {
      revalidatePath('/kit');
    }

    await logAuditEvent({
      action: 'seo.publish',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: result.override.id,
      meta: {
        scope: result.override.scope,
        targetKey: result.override.targetKey,
        snapshotId: result.snapshot.id,
      },
    });

    return NextResponse.json({ override: result.override, snapshotId: result.snapshot.id });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
