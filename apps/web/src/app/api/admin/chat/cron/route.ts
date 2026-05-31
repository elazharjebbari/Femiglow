/**
 * Admin trigger manuel pour les crons chat (kb-sync, intent-recompute).
 *
 * Permet à l'admin de relancer un cron sans attendre le schedule Vercel,
 * utile pour :
 *   - Ré-ingérer immédiatement après import CSV.
 *   - Recalculer les centroïdes après ajout d'exemples.
 *   - Tester un cron sans déployer en prod.
 *
 * Form-encoded → redirect 303 vers `/admin/chat/system?ok=*&report=*` ;
 * JSON → JSON response.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { watchProviderBudgets } from '@/lib/chat/services/budget-watch';
import { recomputeAllCentroids } from '@/lib/chat/services/intent-recompute';
import { syncKnowledgeSources } from '@/lib/chat/services/kb-sync';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = new Set(['kb-sync', 'intent-recompute', 'budget-watch']);

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  const payload = await parsePayload(req, ct);
  const job = typeof payload.job === 'string' ? payload.job : null;
  if (!job || !ALLOWED.has(job)) {
    return NextResponse.json({ error: 'invalid-job' }, { status: 400 });
  }

  let report: unknown;
  try {
    if (job === 'kb-sync') {
      report = await syncKnowledgeSources();
    } else if (job === 'intent-recompute') {
      report = await recomputeAllCentroids();
    } else {
      report = await watchProviderBudgets();
    }
  } catch (err) {
    logger.error('chat.admin.cron.trigger_failed', {
      job,
      error: (err as Error).message,
      by: auth.email,
    });
    return NextResponse.json(
      { error: 'job-failed', reason: (err as Error).message },
      { status: 500 },
    );
  }

  logger.info('chat.admin.cron.triggered', { job, by: auth.email });

  if (ct.includes('application/json')) {
    return NextResponse.json({ job, report });
  }
  return NextResponse.redirect(
    new URL(`/admin/chat/system?ok=cron-${job}`, req.url),
    303,
  );
}

async function parsePayload(
  req: NextRequest,
  ct: string,
): Promise<Record<string, unknown>> {
  if (ct.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
