/**
 * GET   /api/admin/kit/video → renvoie l'override courant + aperçu draft résolu.
 * PATCH /api/admin/kit/video → patch partiel (save brouillon).
 *
 * Auth admin obligatoire. Audit log à chaque mutation.
 * Revalidation `kit:video` à chaque écriture.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { kitVideoOverrideUpsertSchema } from '@/lib/kit/video/schemas';
import { resolveKitVideoDraft } from '@/lib/kit/video/resolver';
import { getKitVideoOverride, upsertKitVideoOverride } from '@/lib/kit/video/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tag stable utilisé par le resolver public + les listes admin. */
export const KIT_VIDEO_TAG = 'kit:video';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const override = getKitVideoOverride();
    const resolved = resolveKitVideoDraft();
    return NextResponse.json({ override, resolved });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = kitVideoOverrideUpsertSchema.safeParse(body);
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
    const saved = upsertKitVideoOverride(parsed.data, { actorId: session.adminId });
    revalidateTag(KIT_VIDEO_TAG);
    await logAuditEvent({
      action: 'kit_video.update',
      actorId: session.adminId,
      resourceType: 'kit_video_override',
      resourceId: saved.id,
      meta: { patchKeys: Object.keys(parsed.data) },
    });
    return NextResponse.json({ override: saved }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
