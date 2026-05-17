import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from "@/lib/content-studio/auth";
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listPosts } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    return NextResponse.json({ posts: await listPosts() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

