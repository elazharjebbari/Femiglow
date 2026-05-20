/**
 * POST /api/admin/kit/video/publish
 *
 * Marque l'override comme publié (`publishedAt = now`). Idempotent — un
 * re-publish d'un override déjà publié pousse juste un nouveau timestamp.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { publishKitVideoOverride } from '@/lib/kit/video/store';
import { KIT_VIDEO_TAG } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const published = publishKitVideoOverride();
    if (!published) {
      throw new HttpError(
        'not_found',
        'Aucun brouillon à publier (override absent).',
      );
    }
    revalidateTag(KIT_VIDEO_TAG);
    await logAuditEvent({
      action: 'kit_video.publish',
      actorId: session.adminId,
      resourceType: 'kit_video_override',
      resourceId: published.id,
      meta: { publishedAt: published.publishedAt },
    });
    return NextResponse.json({ override: published }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
