import { describe, it, expect } from 'vitest';
import { computeBackoff, MAX_ATTEMPTS, RETRY_SCHEDULE_MS } from './backoff';

describe('computeBackoff', () => {
  it('respecte la suite [60s, 5m, 30m, 3h, 12h] ± jitter 20 %', () => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const base = RETRY_SCHEDULE_MS[Math.min(attempt, RETRY_SCHEDULE_MS.length - 1)] ?? 60_000;
      const min = Math.round(base * 0.8);
      const max = Math.round(base * 1.2);
      const value = computeBackoff(attempt, () => 0.5);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });

  it('utilise le dernier palier au-delà de MAX_ATTEMPTS', () => {
    const last = RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1] ?? 60_000;
    const value = computeBackoff(99, () => 0);
    expect(value).toBeGreaterThanOrEqual(Math.round(last * 0.8));
    expect(value).toBeLessThanOrEqual(Math.round(last * 1.2));
  });

  it('plancher à 1 seconde', () => {
    const value = computeBackoff(0, () => -1);
    expect(value).toBeGreaterThanOrEqual(1_000);
  });
});
