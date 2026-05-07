import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { findMediaById } from '@/lib/db/queries/media';
import { enqueueJob } from '@/lib/db/queries/media-jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const media = await findMediaById(params.id);
    if (!media) throw new HttpError('not_found', 'Media introuvable');
    const job = await enqueueJob({
      mediaId: params.id,
      kind: 'regenerate',
      payload: { reason: 'manual' },
    });
    await logAuditEvent({
      action: 'media.regenerated',
      actorId: session.adminId,
      resourceType: 'media',
      resourceId: params.id,
      meta: { jobId: job.id },
    });
    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
