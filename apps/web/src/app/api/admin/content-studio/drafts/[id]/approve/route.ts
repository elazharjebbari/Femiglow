import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { approveContentDraft } from '@/lib/content-studio/service';
import { requireContentStudioEnabled } from '@/lib/content-studio/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdmin('/admin/content-studio');
    const post = await approveContentDraft({ draftId: params.id, actorId: session.adminId });
    return NextResponse.json({ post });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

