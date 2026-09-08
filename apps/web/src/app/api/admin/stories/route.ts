/**
 * GET  /api/admin/stories  → liste des stories (avec segments)
 * POST /api/admin/stories  → création d'une story
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { storyInputSchema } from '@/lib/stories/schemas';
import { createStory, listStories } from '@/lib/db/queries/stories';
import { revalidateStories } from '@/lib/stories/revalidate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const items = await listStories();
    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = storyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }
    const created = await createStory(parsed.data);
    revalidateStories();
    await logAuditEvent({
      action: 'stories.create',
      actorId: session.adminId,
      resourceType: 'media_story',
      resourceId: created.id,
      meta: { slug: created.slug },
    });
    return NextResponse.json({ story: created }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
