import { memoryStore } from '@/lib/db/client';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): Promise<RateLimitResult> {
  const store = memoryStore();
  const now = input.now ?? Date.now();
  const current = store.rateLimitCounters.get(input.key);
  if (!current || current.resetAt <= now) {
    store.rateLimitCounters.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return { ok: true, remaining: input.limit - 1, resetAt: now + input.windowMs };
  }
  if (current.count >= input.limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }
  const next = { count: current.count + 1, resetAt: current.resetAt };
  store.rateLimitCounters.set(input.key, next);
  return { ok: true, remaining: input.limit - next.count, resetAt: next.resetAt };
}
