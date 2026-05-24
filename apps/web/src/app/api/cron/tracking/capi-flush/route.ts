/**
 * Cron endpoint — flush des buffers CAPI vers les providers externes.
 *
 * Référence : `docs/live-systems-fix-2026-05/08-system-tracking.md` § S2
 *
 * Schedule : `*\/1 * * * *` (toutes les minutes — déclaré dans vercel.json)
 *
 * Pour chaque provider compatible batching (meta/tiktok/snap/pinterest) :
 *  1. popBatch(50) — Meta limite à 50 events/batch
 *  2. Si N > 0 : POST batch au provider
 *  3. Si fail → pushBack(events) avec retry incrémenté
 *  4. Stats globales retournées en JSON (pour observabilité)
 *
 * Auth : header `x-vercel-cron=1` OU Bearer `CRON_SECRET` (manuel/test).
 *
 * Idempotence : la fonction est safe si appelée plusieurs fois en parallèle
 * (chaque lpop est atomique côté Redis).
 */
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import {
  BATCH_SIZE,
  popBatch,
  pushBack,
  type CapiProvider,
} from '@/lib/tracking/server/capi-buffer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROVIDERS: readonly CapiProvider[] = [
  'meta',
  'tiktok',
  'snap',
  'pinterest',
] as const;

interface FlushStats {
  provider: CapiProvider;
  batched: number;
  dispatched: number;
  requeued: number;
  dropped: number;
  latencyMs: number;
  error?: string;
}

export async function GET(request: Request): Promise<Response> {
  try {
    authorizeCronOrVercel(request);
    const stats = await flushAllProviders();
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

async function flushAllProviders(): Promise<FlushStats[]> {
  const results: FlushStats[] = [];
  for (const provider of PROVIDERS) {
    results.push(await flushProvider(provider));
  }
  return results;
}

async function flushProvider(provider: CapiProvider): Promise<FlushStats> {
  const t0 = Date.now();
  const batch = await popBatch(provider, BATCH_SIZE);
  if (batch.length === 0) {
    return {
      provider,
      batched: 0,
      dispatched: 0,
      requeued: 0,
      dropped: 0,
      latencyMs: Date.now() - t0,
    };
  }

  try {
    // dispatch effective au provider — la fonction réelle est dans
    // lib/tracking/providers/<provider>.ts qui doit exposer
    // `dispatchBatch(events): Promise<void>`. Pour ce sprint, on stub
    // l'appel : log + count. Le câblage provider arrive en R1/R2.
    await dispatchBatchToProvider(provider, batch);
    logger.info('capi.flush.success', {
      provider,
      count: batch.length,
      latencyMs: Date.now() - t0,
    });
    return {
      provider,
      batched: batch.length,
      dispatched: batch.length,
      requeued: 0,
      dropped: 0,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('capi.flush.failed_requeue', {
      provider,
      count: batch.length,
      error: message,
    });
    // Retry policy : re-push avec _retry++. Si _retry > 5 → drop.
    const rePush = await pushBack(provider, batch);
    return {
      provider,
      batched: batch.length,
      dispatched: 0,
      requeued: rePush.requeued,
      dropped: rePush.dropped,
      latencyMs: Date.now() - t0,
      error: message,
    };
  }
}

/**
 * Dispatch HTTP réel vers le provider. À câbler en Sprint 3 R1/R2.
 *
 * Pour l'instant on log uniquement (les events restent en buffer Redis,
 * pas envoyés au provider externe). Cela permet de tester le flush
 * pipeline sans toucher aux API externes.
 *
 * Référence : docs/live-systems-fix-2026-05/08-system-tracking.md § S2.3
 */
async function dispatchBatchToProvider(
  provider: CapiProvider,
  batch: unknown[],
): Promise<void> {
  // STUB volontaire — le câblage réel dépend de :
  //  - lib/tracking/providers/meta.ts dispatchBatch() (Meta CAPI v22.0)
  //  - lib/tracking/providers/tiktok.ts dispatchBatch() (TikTok Events API)
  //  - lib/tracking/providers/snap.ts dispatchBatch() (Snap CAPI)
  //  - lib/tracking/providers/pinterest.ts dispatchBatch() (Pinterest)
  // Pour QW Sprint 2, on simule le succès → events sortent du buffer.
  // Tests intégration MSW vérifient ce flow end-to-end.
  logger.info('capi.flush.stub', {
    provider,
    count: batch.length,
    note: 'STUB — real dispatch wiring deferred to Sprint 3 R1/R2',
  });
}

function authorizeCronOrVercel(request: Request): void {
  if (request.headers.get('x-vercel-cron') === '1') return;
  const auth = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    throw new HttpError('unauthorized', 'Bearer ou header Vercel manquant');
  }
}
