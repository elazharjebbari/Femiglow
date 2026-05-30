import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  requireAdminApi,
  requireContentStudioEnabled,
  requireMediaStudioEnabled,
} from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { voiceoverGenerationSchema } from '@/lib/content-studio/schemas';
import { generateVoiceoverForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// MP-VO-03 (BUG-004) — POST /api/admin/content-studio/drafts/[id]/generate-voiceover
// Mirrors generate-visual/route.ts: cookie-driven mock|live mode, strict payload,
// formatErrorResponse envelope. Gated behind the media-studio flag (D6).
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    requireMediaStudioEnabled();
    const session = await requireAdminApi();

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = voiceoverGenerationSchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload voix-off invalide.', parsed.error.flatten());
    }

    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' =
      modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';

    const media = await generateVoiceoverForDraft({
      draftId: params.id,
      actorId: session.adminId,
      script: parsed.data.script,
      voice: parsed.data.voice,
      mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
