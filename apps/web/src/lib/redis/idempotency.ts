/**
 * Idempotency keys end-to-end via Redis.
 *
 * Référence : `docs/live-systems-fix-2026-05/03-plan-action-phases.md` § R3
 *
 * Pattern :
 *  - Client envoie header `Idempotency-Key: <uuid>` sur POST critique
 *  - Serveur stocke `idem:<endpoint>:<key>` → response_payload (24h TTL)
 *  - Si replay → return cached response (pas de double traitement)
 *  - Si en cours → return 409 Conflict (avec retry-after)
 *
 * États stockés :
 *  - PROCESSING : début de traitement (lock pour éviter race)
 *  - COMPLETED  : résultat caché
 *  - FAILED     : erreur cachée (re-throw au caller)
 *
 * TTL par défaut 24h — couvre les replays clients raisonnables sans
 * grossir Redis indéfiniment.
 */
import 'server-only';
import { redis } from './client';
import { logger } from '@/lib/logging/logger';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h
const PROCESSING_TTL_SECONDS = 60; // lock 1min pendant traitement

export interface IdempotencyResult<T = unknown> {
  /** Status du traitement précédent (si existant). */
  status: 'fresh' | 'processing' | 'completed' | 'failed';
  /** Cached response si status='completed'. */
  cachedResult?: T;
  /** Cached error si status='failed'. */
  cachedError?: string;
  /** Latence (ms) à la première exécution si completed. */
  cachedLatencyMs?: number;
}

function key(endpoint: string, idempotencyKey: string): string {
  return `idem:${endpoint}:${idempotencyKey}`;
}

/**
 * Vérifie si une clé d'idempotence est déjà connue.
 *
 * - `fresh` → première fois, le caller peut traiter normalement
 * - `processing` → autre lambda traite déjà → 409 Conflict
 * - `completed` → return cached result (HTTP 200 sans réexécution)
 * - `failed` → return cached error (HTTP 5xx sans réexécution)
 */
export async function checkIdempotency<T = unknown>(
  endpoint: string,
  idempotencyKey: string,
): Promise<IdempotencyResult<T>> {
  if (!idempotencyKey || idempotencyKey.length === 0) {
    return { status: 'fresh' };
  }
  try {
    const raw = await redis.get(key(endpoint, idempotencyKey));
    if (!raw) return { status: 'fresh' };
    const parsed = JSON.parse(raw) as IdempotencyResult<T>;
    return parsed;
  } catch (err) {
    logger.warn('idempotency.check_failed', {
      endpoint,
      error: (err as Error).message,
    });
    // Fail-open : si Redis down, on accepte de traiter (mieux que bloquer)
    return { status: 'fresh' };
  }
}

/**
 * Marque le début d'un traitement (lock court 1min).
 * À appeler avant d'exécuter la logique métier.
 */
export async function markProcessing(
  endpoint: string,
  idempotencyKey: string,
): Promise<void> {
  if (!idempotencyKey) return;
  try {
    const payload: IdempotencyResult = { status: 'processing' };
    await redis.set(key(endpoint, idempotencyKey), JSON.stringify(payload), {
      ex: PROCESSING_TTL_SECONDS,
    });
  } catch (err) {
    logger.warn('idempotency.mark_processing_failed', {
      endpoint,
      error: (err as Error).message,
    });
  }
}

/**
 * Stocke le résultat final (success ou error) avec TTL 24h.
 * À appeler à la fin du traitement, dans un `finally` idéalement.
 */
export async function storeResult<T = unknown>(
  endpoint: string,
  idempotencyKey: string,
  result: { success: T } | { error: string },
  latencyMs: number,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (!idempotencyKey) return;
  try {
    const payload: IdempotencyResult<T> =
      'success' in result
        ? {
            status: 'completed',
            cachedResult: result.success,
            cachedLatencyMs: latencyMs,
          }
        : {
            status: 'failed',
            cachedError: result.error,
            cachedLatencyMs: latencyMs,
          };
    await redis.set(key(endpoint, idempotencyKey), JSON.stringify(payload), {
      ex: ttlSeconds,
    });
  } catch (err) {
    logger.warn('idempotency.store_result_failed', {
      endpoint,
      error: (err as Error).message,
    });
  }
}

/**
 * Wrapper helper : exécute une function avec idempotency garantie.
 *
 * - Si fresh → exécute + cache résultat
 * - Si completed → retourne cached
 * - Si failed → re-throw cached error
 * - Si processing → throw conflict
 *
 * Usage typique :
 * ```ts
 * const result = await withIdempotency(
 *   'POST:/api/checkout/order',
 *   request.headers.get('Idempotency-Key') ?? '',
 *   () => createOrder(payload),
 * );
 * ```
 */
export async function withIdempotency<T>(
  endpoint: string,
  idempotencyKey: string,
  fn: () => Promise<T>,
  options?: { ttlSeconds?: number },
): Promise<T> {
  if (!idempotencyKey) {
    // Pas de clé → exécution sans cache (compat héritage)
    return fn();
  }

  const existing = await checkIdempotency<T>(endpoint, idempotencyKey);

  if (existing.status === 'completed' && existing.cachedResult !== undefined) {
    logger.info('idempotency.replay_hit', {
      endpoint,
      cachedLatencyMs: existing.cachedLatencyMs,
    });
    return existing.cachedResult;
  }

  if (existing.status === 'failed' && existing.cachedError) {
    logger.info('idempotency.replay_failed', { endpoint });
    throw new Error(existing.cachedError);
  }

  if (existing.status === 'processing') {
    throw new IdempotencyConflictError(
      `Requête en cours de traitement (idempotency-key=${idempotencyKey})`,
    );
  }

  // Fresh — exécute
  const t0 = Date.now();
  await markProcessing(endpoint, idempotencyKey);
  try {
    const result = await fn();
    await storeResult(
      endpoint,
      idempotencyKey,
      { success: result },
      Date.now() - t0,
      options?.ttlSeconds,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await storeResult(
      endpoint,
      idempotencyKey,
      { error: message },
      Date.now() - t0,
      options?.ttlSeconds,
    );
    throw err;
  }
}

export class IdempotencyConflictError extends Error {
  public readonly code = 'idempotency_conflict';
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}
