import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { postQuerySchema } from '@/lib/content-studio/schemas';
import { listPosts } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const filters = postQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    return NextResponse.json({ posts: await listPosts(filters) });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}