import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
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
    const json = await request.json().catch(() => ({}));
    const parsed = postRescheduleSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        'invalid_input',
        'Payload re-programmation invalide.',
        parsed.error.flatten(),
      );
    }
    const post = await reschedulePost({ postId: params.id, scheduledAt: parsed.data.scheduledAt });
    return NextResponse.json({ post });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
