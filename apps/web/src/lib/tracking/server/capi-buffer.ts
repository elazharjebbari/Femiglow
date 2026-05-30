/**
 * Buffer Redis pour batching Meta CAPI (et autres providers compatibles).
 *
 * Référence : `docs/live-systems-fix-2026-05/08-system-tracking.md` § S2
 *
 * Pourquoi batcher ?
 * ──────────────────
 * Avant : 1 fetch HTTP par event par provider → coûteux, lent, dégrade
 * le match rate Meta (les events arrivent dispersés, fenêtres de match
 * trop courtes).
 *
 * Après : push dans Redis LIST → cron flush toutes les minutes par
 * batch ≤ 50 events (Meta CAPI accepte 50 max par requête). Latence ingest ÷ ~5,
 * match rate amélioré 2-5% selon retours Meta.
 *
 * Stratégie retry intra-batch :
 *  - Si batch fail → re-push events avec `_retry` count incrémenté
 *  - Si `_retry > 5` → drop avec log (event est trop vieux pour CAPI)
 *
 * Multi-provider : la même API sert pour Meta, TikTok, Snap, Pinterest.
 * Chacun a son propre key Redis (`capi:<provider>:buffer`).
 */
import 'server-only';
import { redis } from '@/lib/redis/client';
import { logger } from '@/lib/logging/logger';

export type CapiProvider = 'meta' | 'tiktok' | 'snap' | 'pinterest';

const MAX_RETRY = 5;

/** Meta CAPI accepte max 50 events / batch ; on garde 50 pour tous. */
export const BATCH_SIZE = 50;

function bufferKey(provider: CapiProvider): string {
  return `capi:${provider}:buffer`;
}

export interface CapiBufferedEvent {
  /** Payload tel qu'attendu par le provider (forme déjà mappée). */
  payload: Record<string, unknown>;
  /** Nombre de retries déjà effectués. Incrémenté à chaque re-push. */
  _retry?: number;
  /** Timestamp d'arrivée en buffer (utile pour debug + TTL côté CAPI). */
  _bufferedAt?: number;
}

/**
 * Push un event en buffer pour batching ultérieur.
 *
 * Retourne true si push effectué, false en cas d'erreur Redis (fail-soft
 * — le caller peut fallback en dispatch direct).
 */
export async function pushToBatch(
  provider: CapiProvider,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const event: CapiBufferedEvent = {
      payload,
      _retry: 0,
      _bufferedAt: Date.now(),
    };
    await redis.rpush(bufferKey(provider), JSON.stringify(event));
    return true;
  } catch (err) {
    logger.warn('capi.buffer.push_failed', {
      provider,
      error: (err as Error).message,
    });
    return false;
  }
}

/**
 * Pop un batch d'events à dispatcher. Retourne `[]` si buffer vide.
 *
 * Le caller doit appeler `pushBack()` en cas de fail pour re-queue.
 */
export async function popBatch(
  provider: CapiProvider,
  count = BATCH_SIZE,
): Promise<CapiBufferedEvent[]> {
  try {
    const raw = await redis.lpop(bufferKey(provider), count);
    if (!raw || raw.length === 0) return [];
    const items: CapiBufferedEvent[] = [];
    for (const r of raw) {
      try {
        items.push(JSON.parse(r) as CapiBufferedEvent);
      } catch (parseErr) {
        logger.warn('capi.buffer.parse_failed', {
          provider,
          rawSample: r.slice(0, 100),
          error: (parseErr as Error).message,
        });
      }
    }
    return items;
  } catch (err) {
    logger.warn('capi.buffer.pop_failed', {
      provider,
      error: (err as Error).message,
    });
    return [];
  }
}

/**
 * Re-push des events après échec batch. Incrémente `_retry`.
 * Drop ceux qui dépassent MAX_RETRY (avec log warning).
 *
 * Retourne le count effectivement re-pushé.
 */
export async function pushBack(
  provider: CapiProvider,
  events: CapiBufferedEvent[],
): Promise<{ requeued: number; dropped: number }> {
  let requeued = 0;
  let dropped = 0;
  for (const event of events) {
    const retry = (event._retry ?? 0) + 1;
    if (retry > MAX_RETRY) {
      dropped += 1;
      logger.warn('capi.buffer.dropped_max_retry', {
        provider,
        bufferedAt: event._bufferedAt,
        retries: retry,
      });
      continue;
    }
    try {
      await redis.rpush(
        bufferKey(provider),
        JSON.stringify({ ...event, _retry: retry }),
      );
      requeued += 1;
    } catch (err) {
      dropped += 1;
      logger.warn('capi.buffer.push_back_failed', {
        provider,
        error: (err as Error).message,
      });
    }
  }
  return { requeued, dropped };
}

/**
 * Taille courante du buffer — utile pour dashboard + alerte.
 */
export async function getBufferSize(provider: CapiProvider): Promise<number> {
  try {
    return await redis.llen(bufferKey(provider));
  } catch (err) {
    logger.warn('capi.buffer.size_failed', {
      provider,
      error: (err as Error).message,
    });
    return 0;
  }
}

/**
 * Clear complet — testing/debug uniquement.
 */
export async function clearBuffer(provider: CapiProvider): Promise<void> {
  await redis.del(bufferKey(provider));
}
