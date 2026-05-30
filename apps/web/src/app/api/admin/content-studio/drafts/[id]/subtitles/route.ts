import { NextResponse } from 'next/server';
import {
  requireAdminApi,
  requireContentStudioEnabled,
  requireMediaStudioEnabled,
} from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { subtitlesSaveSchema } from '@/lib/content-studio/schemas';
import { saveSubtitlesForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// MP-SU-05 (BUG-004) — PUT .../drafts/[id]/subtitles : authoritative save of the
// operator-edited cues (server-side validation in saveSubtitlesForDraft).
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    requireMediaStudioEnabled();
    const session = await requireAdminApi();

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = subtitlesSaveSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Sous-titres invalides.', parsed.error.flatten());
    }

    const media = await saveSubtitlesForDraft({
      draftId: params.id,
      actorId: session.adminId,
      cues: parsed.data.cues,
      style: parsed.data.style,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
