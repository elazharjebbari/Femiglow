import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { briefUpdateSchema } from '@/lib/content-studio/schemas';
import { getBrief } from '@/lib/content-studio/repository';
import { updateContentBrief } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const brief = await getBrief(params.id);
    if (!brief) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Brief introuvable.' } }, { status: 404 });
    }
    return NextResponse.json({ brief });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = briefUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Brief invalide.', details: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const brief = await updateContentBrief({ briefId: params.id, patch: parsed.data });
    return NextResponse.json({ brief });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}