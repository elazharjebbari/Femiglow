import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { contentIdeaCreateSchema, ideaQuerySchema } from '@/lib/content-studio/schemas';
import { createContentIdea, listIdeas } from '@/lib/content-studio/service';
import { getIdempotencyKey, getExistingResponse, storeIdempotentResponse } from '@/lib/content-studio/idempotency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const filters = ideaQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    return NextResponse.json({ ideas: await listIdeas(filters) });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const idempotencyKey = getIdempotencyKey(request);
    if (idempotencyKey) {
      const existing = getExistingResponse(idempotencyKey);
      if (existing) return NextResponse.json(existing, { status: 201 });
    }
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = contentIdeaCreateSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Idée invalide.', parsed.error.flatten());
    }
    const idea = await createContentIdea({ ...parsed.data, actorId: session.adminId });
    const responseBody = { idea };
    if (idempotencyKey) storeIdempotentResponse(idempotencyKey, responseBody);
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

