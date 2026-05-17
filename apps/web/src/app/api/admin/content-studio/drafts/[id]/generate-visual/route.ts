import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireContentStudioEnabled } from '@/lib/content-studio/auth';
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
    const session = await requireAdmin('/admin/content-studio');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = visualGenerationSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload génération visuelle invalide.', parsed.error.flatten());
    }
    const media = await generateVisualForDraft({
      draftId: params.id,
      actorId: session.adminId,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      quality: parsed.data.quality,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
