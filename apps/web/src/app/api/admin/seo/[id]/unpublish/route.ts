/**
 * POST /api/admin/seo/[id]/unpublish — clear publishedAt + revalidate + audit.
 *
 * L'override reste visible côté admin mais cesse d'être consommé par le
 * resolver public (la cascade retombe sur settings → defaults).
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { unpublishOverride } from '@/lib/db/queries/seo';
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
    const updated = await unpublishOverride(params.id);
    if (!updated) throw new HttpError('not_found', 'Override introuvable.');

    revalidateTag(SEO_TAG);
    revalidateTag(seoTargetTag(updated.scope, updated.targetKey));
    if (updated.scope === 'product' && updated.targetKey === 'le-kit') {
      revalidatePath('/kit');
    }

    await logAuditEvent({
      action: 'seo.unpublish',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: updated.id,
      meta: { scope: updated.scope, targetKey: updated.targetKey },
    });

    return NextResponse.json({ override: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
