import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { reschedulePost } from '@/lib/content-studio/service';
import { postRescheduleSchema } from '@/lib/content-studio/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const body = postRescheduleSchema.parse(await request.json());
    const post = await reschedulePost({ postId: params.id, scheduledAt: body.scheduledAt });
    return NextResponse.json({ post });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}