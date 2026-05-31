/**
 * POST /api/admin/seeders/jobs/[jobId]/cancel
 * → marque le job comme cancellation requested. L'orchestrateur respecte
 * `abort.signal` entre chaque seeder (pas d'interruption à mi-seeder).
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { getJobStore } from '@/lib/seeders/job-store';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const params = await Promise.resolve(ctx.params);
    const job = getJobStore().get(params.jobId);
    if (!job) throw new HttpError('not_found', 'Job introuvable ou expiré.');

    if (
      job.status === 'completed' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      return NextResponse.json({
        ok: true,
        alreadyFinished: true,
        status: job.status,
      });
    }

    job.abort.abort();
    logger.info('admin.seeders.cancel', {
      jobId: params.jobId,
      adminId: session.adminId,
    });

    return NextResponse.json({ ok: true, status: 'cancelling' });
  } catch (err) {
    logger.error('admin.seeders.cancel.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
