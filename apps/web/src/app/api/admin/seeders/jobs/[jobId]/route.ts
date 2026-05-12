/**
 * GET /api/admin/seeders/jobs/[jobId]
 * → snapshot complet d'un job (status + events bufferisés).
 *
 * Utilisé en fallback si le client perd la connexion SSE et veut récupérer
 * l'état complet sans reprendre le flux depuis le début.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { getJobStore } from '@/lib/seeders/job-store';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> | { jobId: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const params = await Promise.resolve(ctx.params);
    const snap = getJobStore().snapshot(params.jobId);
    if (!snap) throw new HttpError('not_found', 'Job introuvable ou expiré.');

    return NextResponse.json(snap);
  } catch (err) {
    logger.error('admin.seeders.jobs.snapshot.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
