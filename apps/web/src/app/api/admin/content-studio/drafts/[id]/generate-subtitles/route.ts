import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  requireAdminApi,
  requireContentStudioEnabled,
  requireMediaStudioEnabled,
} from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { subtitlesGenerationSchema } from '@/lib/content-studio/schemas';
import { generateSubtitlesForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// MP-SU-04 (BUG-004) — POST .../drafts/[id]/generate-subtitles
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    requireMediaStudioEnabled();
    const session = await requireAdminApi();

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = subtitlesGenerationSchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload sous-titres invalide.', parsed.error.flatten());
    }

    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' =
      modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';

    const media = await generateSubtitlesForDraft({
      draftId: params.id,
      actorId: session.adminId,
      script: parsed.data.script,
      refine: parsed.data.refine,
      mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
