/**
 * PATCH  /api/admin/stories/segments/[segId]  → maj segment
 * DELETE /api/admin/stories/segments/[segId]  → suppression segment
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { storySegmentPatchSchema } from '@/lib/stories/schemas';
import { deleteSegment, updateSegment } from '@/lib/db/queries/stories';
import { revalidateStories } from '@/lib/stories/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ segId: string }> | { segId: string } };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { segId } = await Promise.resolve(ctx.params);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = storySegmentPatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }
    const updated = await updateSegment(segId, parsed.data);
    if (!updated) throw new HttpError('not_found', 'Segment introuvable.');
    revalidateStories();
    await logAuditEvent({
      action: 'stories.segment.update',
      actorId: session.adminId,
      resourceType: 'media_story_segment',
      resourceId: segId,
      meta: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ segment: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { segId } = await Promise.resolve(ctx.params);
    await deleteSegment(segId);
    revalidateStories();
    await logAuditEvent({
      action: 'stories.segment.delete',
      actorId: session.adminId,
      resourceType: 'media_story_segment',
      resourceId: segId,
      meta: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
