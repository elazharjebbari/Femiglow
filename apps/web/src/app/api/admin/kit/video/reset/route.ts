/**
 * POST /api/admin/kit/video/reset
 *
 * Supprime totalement l'override. La page `/kit` retombe sur le mock.
 * Idempotent — re-reset sur store vide ne fait rien (200).
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { getKitVideoOverride, resetKitVideoOverride } from '@/lib/kit/video/store';
import { KIT_VIDEO_TAG } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const existing = getKitVideoOverride();
    resetKitVideoOverride();
    revalidateTag(KIT_VIDEO_TAG);
    await logAuditEvent({
      action: 'kit_video.reset',
      actorId: session.adminId,
      resourceType: 'kit_video_override',
      resourceId: existing?.id ?? null,
      meta: { hadOverride: existing !== null },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
