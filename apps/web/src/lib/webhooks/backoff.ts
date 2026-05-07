export const RETRY_SCHEDULE_MS: readonly number[] = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  3 * 60 * 60_000,
  12 * 60 * 60_000,
];

export const MAX_ATTEMPTS = RETRY_SCHEDULE_MS.length;

const JITTER_RATIO = 0.2;

export function computeBackoff(attemptCount: number, rand: () => number = Math.random): number {
  const idx = Math.min(attemptCount, RETRY_SCHEDULE_MS.length - 1);
  const base = RETRY_SCHEDULE_MS[idx] ?? RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1] ?? 60_000;
  const jitter = base * JITTER_RATIO * (rand() * 2 - 1);
  return Math.max(1_000, Math.round(base + jitter));
}
