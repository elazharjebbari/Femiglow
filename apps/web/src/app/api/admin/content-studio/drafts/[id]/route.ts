import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { draftUpdateSchema } from '@/lib/content-studio/schemas';
import { updateContentDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = draftUpdateSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Brouillon invalide.', parsed.error.flatten());
    }
    const draft = await updateContentDraft({
      draftId: params.id,
      actorId: session.adminId,
      patch: parsed.data,
    });
    return NextResponse.json({ draft });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

