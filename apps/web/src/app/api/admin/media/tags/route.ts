import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { createTag, deleteTag, listTags } from '@/lib/db/queries/media-tags';
import { logAuditEvent } from '@/lib/audit/log-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tagCreateSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    return NextResponse.json({ tags: await listTags() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = tagCreateSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Tag invalide');
    const tag = await createTag(parsed.data);
    await logAuditEvent({
      action: 'media.tag_created',
      actorId: session.adminId,
      resourceType: 'media_tag',
      resourceId: tag.id,
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError('invalid_input', 'id requis');
    await deleteTag(id);
    await logAuditEvent({
      action: 'media.tag_deleted',
      actorId: session.adminId,
      resourceType: 'media_tag',
      resourceId: id,
    });
    return NextResponse.json({ id, deleted: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
