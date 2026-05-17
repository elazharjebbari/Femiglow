import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { postizDraftSchema } from '@/lib/content-studio/schemas';
import { createDraftInPostiz } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = postizDraftSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload Postiz invalide.', parsed.error.flatten());
    }
    const result = await createDraftInPostiz({
      postId: params.id,
      integrationId: parsed.data.integrationId,
      actorId: session.adminId,
      scheduledAt: parsed.data.scheduledAt,
      tags: parsed.data.tags,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
