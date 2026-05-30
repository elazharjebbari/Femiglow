import { NextResponse } from 'next/server';
import {
  requireAdminApi,
  requireContentStudioEnabled,
  requireMediaStudioEnabled,
} from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { suggestVoiceoverScript } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// MP-VO ergonomics — GET .../drafts/[id]/voiceover-script : suggested narration
// text (draft-derived, or the stored one if a voice-over already exists) so the
// operator can review/edit BEFORE generating the audio. Produces no media.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    requireMediaStudioEnabled();
    await requireAdminApi();
    const { script } = await suggestVoiceoverScript(params.id);
    return NextResponse.json({ script });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
