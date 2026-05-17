import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse } from '@/lib/errors/http-error';
import { reviewContentDraft } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const review = await reviewContentDraft({ draftId: params.id });
    return NextResponse.json({ review });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

