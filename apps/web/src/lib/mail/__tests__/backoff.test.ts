import { describe, it, expect } from 'vitest';
import { computeBackoff, computeNextRetryAt, MAX_ATTEMPTS } from '../backoff';

describe('backoff', () => {
  describe('computeBackoff', () => {
    it('returns 0 for attempt <= 0', () => {
      expect(computeBackoff(0)).toBe(0);
      expect(computeBackoff(-1)).toBe(0);
    });

    it('returns increasing delays for increasing attempts', () => {
      const now = () => 0; // deterministic jitter
      const d1 = computeBackoff(1, now);
      const d2 = computeBackoff(2, now);
      const d3 = computeBackoff(3, now);
      expect(d1).toBeGreaterThanOrEqual(60_000);
      expect(d2).toBeGreaterThan(d1);
      expect(d3).toBeGreaterThan(d2);
    });

    it('is capped at 1 hour even for huge attempts', () => {
      const oneHourMs = 60 * 60_000;
      const d = computeBackoff(20, () => 0);
      // base capped + jitter ≤ 30 %
      expect(d).toBeLessThanOrEqual(oneHourMs * 1.3 + 1);
    });

    it('uses deterministic jitter when now() is provided', () => {
      const a = computeBackoff(3, () => 500);
      const b = computeBackoff(3, () => 500);
      expect(a).toBe(b);
    });

    it('MAX_ATTEMPTS is 5', () => {
      expect(MAX_ATTEMPTS).toBe(5);
    });
  });

  describe('computeNextRetryAt', () => {
    it('returns a Date in the future for attempt > 0', () => {
      const now = new Date('2026-05-13T12:00:00Z');
      const next = computeNextRetryAt(1, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('returns same time for attempt = 0', () => {
      const now = new Date('2026-05-13T12:00:00Z');
      expect(computeNextRetryAt(0, now).getTime()).toBe(now.getTime());
    });
  });
});
