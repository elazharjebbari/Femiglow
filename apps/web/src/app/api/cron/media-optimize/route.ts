import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { runWorkerOnce } from '@/lib/media/worker/process-job';
import { revalidateForMediaChange } from '@/lib/components/media-variants/revalidate.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_DURATION_MS = 50_000;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }

    const startedAt = Date.now();
    let processed = 0;
    const mediaIds = new Set<string>();
    while (Date.now() - startedAt < MAX_DURATION_MS) {
      const result = await runWorkerOnce();
      processed += result.processed;
      for (const id of result.mediaIds) mediaIds.add(id);
      if (result.processed === 0) break;
    }
    const tookMs = Date.now() - startedAt;
    // Variants (re)générés : les liaisons (`components`) et les ensembles
    // qui affichent ces médias (`components:media-sets:<key>`, ciblé) sont
    // en cache 30 min et doivent relire les nouvelles URL, dimensions et flous.
    if (mediaIds.size > 0) await revalidateForMediaChange(mediaIds, 'cron/media-optimize');

    logger.info('cron.media_optimize.completed', { processed, took_ms: tookMs });
    await logAuditEvent({
      action: 'system.media_optimize_tick',
      actorId: null,
      meta: { processed, took_ms: tookMs },
    });
    return NextResponse.json({ processed, tookMs });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
