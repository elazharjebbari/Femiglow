/**
 * POST /api/admin/kit/pack/publish
 *
 * Marque l'override pack comme publié (`publishedAt = now`). Idempotent.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { KIT_PACK_TAG } from '@/lib/kit/pack/resolver';
import { publishKitPackOverride } from '@/lib/kit/pack/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const published = publishKitPackOverride();
    if (!published) {
      throw new HttpError(
        'not_found',
        'Aucun brouillon à publier (override absent).',
      );
    }
    revalidateTag(KIT_PACK_TAG);
    await logAuditEvent({
      action: 'kit_pack.publish',
      actorId: session.adminId,
      resourceType: 'kit_pack_override',
      resourceId: published.id,
      meta: { publishedAt: published.publishedAt },
    });
    return NextResponse.json({ override: published }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
