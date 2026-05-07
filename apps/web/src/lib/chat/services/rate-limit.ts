/**
 * CHA-049 — Middleware rate-limit (token bucket persisté en DB).
 *
 * Trois niveaux : par IP (60 req/min global), par session (30 req/min)
 * et par visitorId (90 req/min). Approche "fixed window" simple,
 * stockée dans `chat_rate_limit_bucket`. Suffisant pour le volume
 * cible ; un upgrade Redis sera fait si on dépasse 1000 RPM.
 *
 * cf. docs/chat-assistant/13-securite-rgpd-moderation.md §6
 */
import { sql } from 'drizzle-orm';

import { env } from '@/lib/env';
import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import { chatRateLimitBucket } from '../db/schema';

const WINDOW_SEC = 60;

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export type RateLimitScope = 'ip' | 'session' | 'visitor';

const LIMITS: Record<RateLimitScope, number> = {
  ip: 60,
  session: 30,
  visitor: 90,
};

/**
 * Tente de consommer 1 jeton sur le bucket `(scope, key)` pour la
 * fenêtre de 60 s en cours. Atomicité garantie par INSERT ON CONFLICT
 * DO UPDATE retournant le nouveau count.
 */
export async function consume(scope: RateLimitScope, key: string): Promise<ConsumeResult> {
  const limit = scopedLimit(scope);
  const db = requireChatDb();

  const windowStart = currentWindowStart();
  const expiresAt = new Date(windowStart.getTime() + WINDOW_SEC * 2 * 1000);

  const id = createId('cr');
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO chat_rate_limit_bucket (id, scope, key, window_start, count, expires_at)
    VALUES (${id}, ${scope}, ${key}, ${windowStart.toISOString()}::timestamptz, 1, ${expiresAt.toISOString()}::timestamptz)
    ON CONFLICT (scope, key, window_start)
    DO UPDATE SET count = chat_rate_limit_bucket.count + 1
    RETURNING count
  `);
  const count = (rows as { rows?: Array<{ count: number }> }).rows?.[0]?.count ?? 1;
  const remaining = Math.max(0, limit - count);
  return {
    allowed: count <= limit,
    remaining,
    resetAt: new Date(windowStart.getTime() + WINDOW_SEC * 1000),
  };
}

export async function purgeExpired(): Promise<number> {
  const db = requireChatDb();
  const res = await db
    .delete(chatRateLimitBucket)
    .where(sql`${chatRateLimitBucket.expiresAt} < NOW()`);
  return (res as { rowCount?: number }).rowCount ?? 0;
}

function currentWindowStart(): Date {
  const now = Date.now();
  const ms = now - (now % (WINDOW_SEC * 1000));
  return new Date(ms);
}

function scopedLimit(scope: RateLimitScope): number {
  // Permet l'override global via env (tests / staging avec quotas plus
  // larges). Si env défini → applique ce plafond pour le scope `ip`
  // (le plus large).
  if (scope === 'ip' && env.CHAT_RATE_LIMIT_PER_MIN) {
    return env.CHAT_RATE_LIMIT_PER_MIN;
  }
  return LIMITS[scope];
}

export const rateLimit = { consume, purgeExpired };
