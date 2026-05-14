import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { submitForReview } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    const updated = await submitForReview(params.slug, session.adminId);
    if (!updated) throw new HttpError('not_found', 'Page non trouvée');

    await logLegalEvent('legal.page.submitted-review', session.adminId, updated.id, {
      slug: updated.slug,
    });

    return NextResponse.json({ status: 'review', submittedAt: updated.submittedAt });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
