/**
 * Tests `retry-policy` — cap attemptCount + backoff exponentiel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decideRetry,
  isDeadLetter,
  MAX_ATTEMPTS,
  timeBeforeDeadLetterHours,
} from './retry-policy';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('decideRetry', () => {
  it('attempt 0 → shouldRetry true, nextRetryAt T+1min', () => {
    const d = decideRetry(0);
    expect(d.shouldRetry).toBe(true);
    expect(d.isDeadLetter).toBe(false);
    expect(d.nextRetryAt?.toISOString()).toBe('2026-05-24T10:01:00.000Z');
  });

  it('attempt 1 → T+5min', () => {
    const d = decideRetry(1);
    expect(d.nextRetryAt?.toISOString()).toBe('2026-05-24T10:05:00.000Z');
  });

  it('attempt 2 → T+15min', () => {
    const d = decideRetry(2);
    expect(d.nextRetryAt?.toISOString()).toBe('2026-05-24T10:15:00.000Z');
  });

  it('attempt 3 → T+1h', () => {
    const d = decideRetry(3);
    expect(d.nextRetryAt?.toISOString()).toBe('2026-05-24T11:00:00.000Z');
  });

  it('attempt 4 → T+6h (last backoff)', () => {
    const d = decideRetry(4);
    expect(d.nextRetryAt?.toISOString()).toBe('2026-05-24T16:00:00.000Z');
  });

  it('attempt 5 (== MAX_ATTEMPTS) → dead letter', () => {
    const d = decideRetry(5);
    expect(d.shouldRetry).toBe(false);
    expect(d.isDeadLetter).toBe(true);
    expect(d.nextRetryAt).toBe(null);
    expect(d.reason).toContain('Max attempts');
  });

  it('attempt > MAX → dead letter (safety net)', () => {
    const d = decideRetry(10);
    expect(d.isDeadLetter).toBe(true);
  });

  it('reason inclus nombre tentative', () => {
    const d = decideRetry(2);
    expect(d.reason).toContain('attempt 3/5');
  });
});

describe('isDeadLetter', () => {
  it('attempt < MAX → false', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(isDeadLetter(i)).toBe(false);
    }
  });

  it('attempt === MAX → true', () => {
    expect(isDeadLetter(MAX_ATTEMPTS)).toBe(true);
  });

  it('attempt > MAX → true', () => {
    expect(isDeadLetter(MAX_ATTEMPTS + 1)).toBe(true);
    expect(isDeadLetter(100)).toBe(true);
  });
});

describe('timeBeforeDeadLetterHours', () => {
  it('retourne le temps total cumulé (1+5+15+60+360 min = 441 min = 7.4h)', () => {
    expect(timeBeforeDeadLetterHours()).toBe(7.4);
  });
});

describe('MAX_ATTEMPTS constante', () => {
  it('est exactement 5 (documentation contract)', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
