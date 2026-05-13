/**
 * Exponential backoff with jitter, capped at 1 hour.
 * Mirrors the convention used in lib/webhooks/backoff.ts for consistency.
 *
 * attempts is 1-based: the delay returned is the wait before attempting again
 * after the Nth failure.
 */
export const MAX_ATTEMPTS = 5;

const BASE_MS = 60_000; // 1 minute
const MAX_MS = 60 * 60_000; // 1 hour

export function computeBackoff(attempt: number, now: () => number = Date.now): number {
  if (attempt <= 0) return 0;
  const base = Math.min(BASE_MS * 2 ** (attempt - 1), MAX_MS);
  // Deterministic jitter using `now()` so tests can fake-timer it.
  const jitter = ((now() % 1000) / 1000) * 0.3 * base;
  return Math.round(base + jitter);
}

export function computeNextRetryAt(attempt: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + computeBackoff(attempt));
}
