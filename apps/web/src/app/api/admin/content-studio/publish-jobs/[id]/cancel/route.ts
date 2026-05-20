import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { cancelPublishJob } from '@/lib/social-publishing/admin-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const result = await cancelPublishJob({ jobId: params.id, actorId: session.adminId });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
