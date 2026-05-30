import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { visualGenerationSchema } from '@/lib/content-studio/schemas';
import { generateVisualForDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = visualGenerationSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload génération visuelle invalide.', parsed.error.flatten());
    }
    // Read the operator's generation mode preference. Cookie set by the
    // GenerationModeToggle component in the UI ; falls back to the env-level
    // mock flag if no cookie present.
    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' =
      modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';
    const media = await generateVisualForDraft({
      draftId: params.id,
      actorId: session.adminId,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      quality: parsed.data.quality,
      kind: parsed.data.kind,
      model: parsed.data.model,
      mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
