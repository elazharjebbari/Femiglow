import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse } from '@/lib/errors/http-error';
import { generateIdeaDrafts } from '@/lib/content-studio/service';
import { ideasGenerateSchema } from '@/lib/content-studio/schemas';

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
    // CS v2 Phase 2 — body is optional (legacy callers send nothing). When
    // present, it may carry { model } to override the default text model.
    const json = await request.json().catch(() => undefined);
    const parsed = ideasGenerateSchema.safeParse(json);
    const model = parsed.success ? parsed.data?.model : undefined;
    // ACT-BE-013 — le mode mock/live pilote RÉELLEMENT le texte : on lit le
    // cookie cs_generation_mode (défaut 'mock' : jamais de live implicite).
    // mock = template déterministe ; live = LLM (ou erreur claire si pas de clé).
    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode = modeCookie === 'live' ? 'live' : 'mock';
    const result = await generateIdeaDrafts({
      ideaId: params.id,
      actorId: session.adminId,
      model,
      mode,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

