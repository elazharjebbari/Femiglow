import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { diffBodies } from '@/lib/legal/diff';
import { getHistoryEntryBySlugVersion } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; v1: string; v2: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const v1 = Number(params.v1);
    const v2 = Number(params.v2);
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 < 1 || v2 < 1) {
      throw new HttpError('invalid_input', 'Versions invalides');
    }

    const [from, to] = await Promise.all([
      getHistoryEntryBySlugVersion(params.slug, v1),
      getHistoryEntryBySlugVersion(params.slug, v2),
    ]);
    if (!from || !to) {
      throw new HttpError('not_found', `Version ${!from ? v1 : v2} introuvable`);
    }

    const diff = diffBodies(from.bodyMd, to.bodyMd);
    return NextResponse.json({
      slug: params.slug,
      from: { version: from.version, publishedAt: from.publishedAt },
      to: { version: to.version, publishedAt: to.publishedAt },
      added: diff.added,
      removed: diff.removed,
      hunks: diff.hunks,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
