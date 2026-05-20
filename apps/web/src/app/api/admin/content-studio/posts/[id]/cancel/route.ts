import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { cancelScheduledPost } from '@/lib/content-studio/service';
import { postCancelSchema } from '@/lib/content-studio/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const body = postCancelSchema.parse(await request.json());
    const post = await cancelScheduledPost({ postId: params.id, reason: body.reason, actorId: session.adminId });
    return NextResponse.json({ post });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}