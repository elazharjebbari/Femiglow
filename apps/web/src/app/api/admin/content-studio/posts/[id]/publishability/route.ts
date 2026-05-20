import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getPostPublishability } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const accountId = new URL(request.url).searchParams.get('accountId');
    const publishability = await getPostPublishability({ postId: params.id, accountId });
    return NextResponse.json({ publishability });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
