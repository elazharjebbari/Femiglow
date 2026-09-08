/**
 * PATCH  /api/admin/stories/[id]  → maj story (dont isActive, displayOrder)
 * DELETE /api/admin/stories/[id]  → suppression (cascade segments)
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { storyPatchSchema } from '@/lib/stories/schemas';
import { deleteStory, updateStory } from '@/lib/db/queries/stories';
import { revalidateStories } from '@/lib/stories/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { id } = await Promise.resolve(ctx.params);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = storyPatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }
    const updated = await updateStory(id, parsed.data);
    if (!updated) throw new HttpError('not_found', 'Story introuvable.');
    revalidateStories();
    await logAuditEvent({
      action: 'stories.update',
      actorId: session.adminId,
      resourceType: 'media_story',
      resourceId: id,
      meta: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ story: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { id } = await Promise.resolve(ctx.params);
    await deleteStory(id);
    revalidateStories();
    await logAuditEvent({
      action: 'stories.delete',
      actorId: session.adminId,
      resourceType: 'media_story',
      resourceId: id,
      meta: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
