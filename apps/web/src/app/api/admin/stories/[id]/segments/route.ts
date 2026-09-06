/** POST /api/admin/stories/[id]/segments → ajoute un segment à la story. */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { storySegmentInputSchema } from '@/lib/stories/schemas';
import { createSegment, getStory } from '@/lib/db/queries/stories';
import { revalidateStories } from '@/lib/stories/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { id } = await Promise.resolve(ctx.params);
    const story = await getStory(id);
    if (!story) throw new HttpError('not_found', 'Story introuvable.');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = storySegmentInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }
    const created = await createSegment(id, parsed.data);
    revalidateStories();
    await logAuditEvent({
      action: 'stories.segment.create',
      actorId: session.adminId,
      resourceType: 'media_story_segment',
      resourceId: created.id,
      meta: { storyId: id },
    });
    return NextResponse.json({ segment: created }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
