/**
 * Métriques streaming chat — observabilité production.
 *
 * Référence : `docs/live-systems-fix-2026-05/06-system-chat-openai.md` § R2
 *
 * Instrumente le pipeline SSE pour mesurer :
 *  - First chunk latency (temps avant le 1er token)
 *  - Inter-chunk latency P95 (smoothness perçue)
 *  - Drop rate (sessions où le stream s'interrompt prématurément)
 *  - Total tokens / latency
 *
 * Stockage :
 *  - Métriques agrégées par bucket minute en Redis (chat:stream:metrics:<min>)
 *  - Reset auto via TTL 24h (no cleanup script needed)
 *
 * Fail-soft : si Redis down → log warn, pas d'erreur cliente.
 */
import 'server-only';
import { redis } from '@/lib/redis/client';
import { logger } from '@/lib/logging/logger';

export interface StreamingMetrics {
  /** Session ID — pour debug + filter. */
  sessionId: string;
  /** Provider utilisé (openai / anthropic / fallback). */
  provider: string;
  /** Nombre de chunks reçus. */
  chunkCount: number;
  /** Latence avant le 1er chunk en ms. */
  firstChunkLatencyMs: number;
  /** Latence totale du stream en ms. */
  totalLatencyMs: number;
  /** Latence moyenne entre chunks. */
  avgInterChunkMs: number;
  /** Latence P95 entre chunks. */
  p95InterChunkMs: number;
  /** Stream s'est-il interrompu prématurément ? */
  dropped: boolean;
  /** Raison du drop si applicable. */
  dropReason?: string;
}

/**
 * Helper instrumentation — appelé à la fin du stream pour enregistrer.
 *
 * Stockage Redis :
 * - chat:stream:total:<minute_bucket> : counter total streams
 * - chat:stream:drops:<minute_bucket> : counter drops
 * - chat:stream:first_chunk_sum_ms:<minute> : sum pour moyenne
 *
 * On utilise INCR (atomique) — pas de race condition multi-lambda.
 */
export async function recordStreamingMetrics(
  metrics: StreamingMetrics,
): Promise<void> {
  try {
    const bucket = currentMinuteBucket();
    const ttlSec = 24 * 60 * 60; // 24h

    // Counters
    await redis.incr(`chat:stream:total:${bucket}`);
    if (metrics.dropped) {
      await redis.incr(`chat:stream:drops:${bucket}`);
    }
    // Set TTL sur les counters (idempotent — N appels = pas de problème)
    await redis.expire(`chat:stream:total:${bucket}`, ttlSec);
    await redis.expire(`chat:stream:drops:${bucket}`, ttlSec);

    // Latence first chunk — push dans LIST pour calc P95 ultérieure
    const latencyEntry = JSON.stringify({
      firstChunkLatencyMs: metrics.firstChunkLatencyMs,
      p95InterChunkMs: metrics.p95InterChunkMs,
      totalLatencyMs: metrics.totalLatencyMs,
      provider: metrics.provider,
      ts: Date.now(),
    });
    await redis.rpush(`chat:stream:samples:${bucket}`, latencyEntry);
    await redis.expire(`chat:stream:samples:${bucket}`, ttlSec);
  } catch (err) {
    logger.warn('chat.stream.metrics_failed', {
      sessionId: metrics.sessionId,
      error: (err as Error).message,
    });
  }
}

/**
 * Helper builder pour instrumenter un AsyncIterable de chunks.
 *
 * Usage typique dans la route SSE :
 * ```ts
 * const meter = new StreamingMeter(sessionId, provider);
 * for await (const chunk of stream) {
 *   meter.onChunk();
 *   res.write(chunk);
 * }
 * meter.onEnd();
 * await recordStreamingMetrics(meter.snapshot());
 * ```
 */
export class StreamingMeter {
  private readonly startedAt: number;
  private firstChunkAt: number | null = null;
  private lastChunkAt: number | null = null;
  private chunkCount = 0;
  private interChunkLatencies: number[] = [];
  private dropped = false;
  private dropReason?: string;

  constructor(
    private readonly sessionId: string,
    private readonly provider: string,
  ) {
    this.startedAt = Date.now();
  }

  onChunk(): void {
    const now = Date.now();
    this.chunkCount += 1;
    if (this.firstChunkAt === null) {
      this.firstChunkAt = now;
    }
    if (this.lastChunkAt !== null) {
      this.interChunkLatencies.push(now - this.lastChunkAt);
    }
    this.lastChunkAt = now;
  }

  onDrop(reason: string): void {
    this.dropped = true;
    this.dropReason = reason;
  }

  onEnd(): void {
    // No-op pour l'instant. Snapshot calcule lazy.
  }

  snapshot(): StreamingMetrics {
    const sorted = [...this.interChunkLatencies].sort((a, b) => a - b);
    const p95 =
      sorted.length > 0
        ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!
        : 0;
    const avg =
      sorted.length > 0
        ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length)
        : 0;

    return {
      sessionId: this.sessionId,
      provider: this.provider,
      chunkCount: this.chunkCount,
      firstChunkLatencyMs: this.firstChunkAt
        ? this.firstChunkAt - this.startedAt
        : 0,
      totalLatencyMs: this.lastChunkAt
        ? this.lastChunkAt - this.startedAt
        : 0,
      avgInterChunkMs: avg,
      p95InterChunkMs: p95,
      dropped: this.dropped,
      ...(this.dropReason ? { dropReason: this.dropReason } : {}),
    };
  }
}

function currentMinuteBucket(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 16)}`; // "2026-05-24T22:23"
}

/**
 * Helpers query pour le dashboard santé chat.
 */
export interface StreamingHealthSummary {
  bucket: string;
  totalStreams: number;
  drops: number;
  dropRatePct: number;
}

export async function getRecentStreamingHealth(
  lookbackMinutes = 60,
): Promise<StreamingHealthSummary[]> {
  const summaries: StreamingHealthSummary[] = [];
  const now = new Date();
  for (let i = 0; i < lookbackMinutes; i++) {
    const d = new Date(now.getTime() - i * 60 * 1000);
    const bucket = d.toISOString().slice(0, 16);
    const total = parseInt(
      (await redis.get(`chat:stream:total:${bucket}`)) ?? '0',
      10,
    );
    const drops = parseInt(
      (await redis.get(`chat:stream:drops:${bucket}`)) ?? '0',
      10,
    );
    if (total === 0) continue;
    summaries.push({
      bucket,
      totalStreams: total,
      drops,
      dropRatePct: total > 0 ? Math.round((drops / total) * 100) : 0,
    });
  }
  return summaries;
}
