import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
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
    const json = await request.json().catch(() => ({}));
    const parsed = postCancelSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload annulation invalide.', parsed.error.flatten());
    }
    const post = await cancelScheduledPost({
      postId: params.id,
      reason: parsed.data.reason,
      actorId: session.adminId,
    });
    return NextResponse.json({ post });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
