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
 * Dispatch HTTP réel vers le provider — Sprint 4 A3 wiring.
 *
 * Le buffer Redis stocke des `CapiBufferedEvent` dont le payload contient
 * directement `{ url, body }` formaté par chaque provider. On itère le
 * batch et fait des fetch parallèles (Promise.all avec cap concurrency).
 *
 * Référence : docs/live-systems-fix-2026-05/08-system-tracking.md § S2
 */
async function dispatchBatchToProvider(
  provider: CapiProvider,
  batch: import('@/lib/tracking/server/capi-buffer').CapiBufferedEvent[],
): Promise<void> {
  // Cap concurrency 10 pour éviter de saturer la lambda
  const CHUNK = 10;
  const failures: string[] = [];

  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async (event) => {
        const payload = event.payload as { url?: string; body?: unknown };
        if (!payload.url || !payload.body) {
          return { ok: false, reason: 'malformed_payload' };
        }
        try {
          const res = await fetch(payload.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload.body),
          });
          if (!res.ok) {
            const errBody = await res.text();
            return {
              ok: false,
              reason: `http_${res.status}: ${errBody.slice(0, 100)}`,
            };
          }
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    for (const r of results) {
      if (!r.ok) failures.push(r.reason ?? 'unknown');
    }
  }

  if (failures.length > 0) {
    // Throw pour que le caller re-push les events (retry policy)
    throw new Error(
      `Dispatch ${provider} failed ${failures.length}/${batch.length}: ${failures.slice(0, 3).join('; ')}`,
    );
  }

  logger.info('capi.flush.dispatched', {
    provider,
    count: batch.length,
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
