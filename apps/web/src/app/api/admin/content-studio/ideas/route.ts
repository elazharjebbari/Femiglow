import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { contentIdeaCreateSchema } from '@/lib/content-studio/schemas';
import { createContentIdea, listIdeas } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    return NextResponse.json({ ideas: await listIdeas() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = contentIdeaCreateSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Idée invalide.', parsed.error.flatten());
    }
    const idea = await createContentIdea({ ...parsed.data, actorId: session.adminId });
    return NextResponse.json({ idea }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

