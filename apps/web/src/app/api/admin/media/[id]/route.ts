import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mediaUpdateSchema } from '@/lib/schemas/admin/media';
import {
  findMediaById,
  getMediaWithRelations,
  hardDeleteMedia,
  softDeleteMedia,
  updateMedia,
} from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';
import type { MediaOverrides } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const media = await getMediaWithRelations(params.id);
    if (!media) throw new HttpError('not_found', 'Media introuvable');
    return NextResponse.json(media);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = mediaUpdateSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload invalide');

    const before = await findMediaById(params.id);
    if (!before) throw new HttpError('not_found', 'Media introuvable');

    const next = await updateMedia(params.id, {
      ...parsed.data,
      overrides: parsed.data.overrides as MediaOverrides | undefined,
    });

    const overrideTouched =
      parsed.data.overrides !== undefined || parsed.data.qualityProfile !== undefined;
    if (overrideTouched && before.kind === 'image') {
      await enqueueJob({ mediaId: params.id, kind: 'regenerate', payload: { reason: 'override' } });
    }

    await logAuditEvent({
      action: 'media.metadata_updated',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: params.id,
      meta: { keys: Object.keys(parsed.data) },
    });
    return NextResponse.json({ id: next.id });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard') === 'true';
    const before = await findMediaById(params.id);
    if (!before) throw new HttpError('not_found', 'Media introuvable');
    if (hard) {
      await hardDeleteMedia(params.id);
    } else {
      await softDeleteMedia(params.id);
    }
    await logAuditEvent({
      action: 'media.deleted',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: params.id,
      meta: { mode: hard ? 'hard' : 'soft' },
    });
    return NextResponse.json({ id: params.id, deleted: true, mode: hard ? 'hard' : 'soft' });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
