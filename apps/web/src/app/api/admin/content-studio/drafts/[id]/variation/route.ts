import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { createVariation } from '@/lib/content-studio/service';
import { draftVariationSchema } from '@/lib/content-studio/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const body = draftVariationSchema.parse(await request.json());
    const draft = await createVariation({ draftId: params.id, variantLabel: body.variantLabel });
    return NextResponse.json({ draft });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}