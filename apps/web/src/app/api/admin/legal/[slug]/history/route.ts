import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listHistoryForSlug } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const entries = await listHistoryForSlug(params.slug);
    return NextResponse.json(
      entries.map((h) => ({
        id: h.id,
        version: h.version,
        published_at: h.publishedAt,
        published_by: h.publishedBy,
        title: h.title,
        body_md_excerpt: h.bodyMd.slice(0, 500),
        git_commit_sha: h.gitCommitSha,
      })),
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
