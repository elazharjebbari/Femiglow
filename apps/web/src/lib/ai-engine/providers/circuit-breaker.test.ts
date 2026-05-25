import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';
import { ProviderError } from './types';

function makeBreaker(overrides: { failureThreshold?: number; resetTimeoutMs?: number; halfOpenMaxCalls?: number } = {}) {
  return new CircuitBreaker({
    failureThreshold: overrides.failureThreshold ?? 3,
    resetTimeoutMs: overrides.resetTimeoutMs ?? 1_000,
    halfOpenMaxCalls: overrides.halfOpenMaxCalls ?? 1,
  });
}

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in CLOSED state', () => {
    const cb = makeBreaker();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('remains CLOSED on successful calls', async () => {
    const cb = makeBreaker();
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after failureThreshold consecutive failures', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    expect(cb.getState()).toBe('OPEN');
  });

  it('does not open before reaching failureThreshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    expect(cb.getState()).toBe('CLOSED');
  });

  it('rejects calls immediately when OPEN', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    await expect(cb.execute(() => Promise.resolve('should not run'))).rejects.toThrow(
      ProviderError,
    );
    await expect(cb.execute(() => Promise.resolve('should not run'))).rejects.toThrow(
      'Circuit breaker is open',
    );
  });

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    vi.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 500 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(500);
    expect(cb.getState()).toBe('HALF_OPEN');

    vi.useRealTimers();
  });

  it('closes on success in HALF_OPEN state', async () => {
    vi.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 500, halfOpenMaxCalls: 1 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    vi.advanceTimersByTime(500);
    expect(cb.getState()).toBe('HALF_OPEN');

    const result = await cb.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');

    vi.useRealTimers();
  });

  it('re-opens on failure in HALF_OPEN state', async () => {
    vi.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 500, halfOpenMaxCalls: 1 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    vi.advanceTimersByTime(500);
    expect(cb.getState()).toBe('HALF_OPEN');

    await cb.execute(() => Promise.reject(new Error('still failing'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    vi.useRealTimers();
  });

  it('reset() brings breaker back to CLOSED', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('rejects when half-open max calls exceeded', async () => {
    vi.useFakeTimers();
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 500, halfOpenMaxCalls: 1 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    vi.advanceTimersByTime(500);
    expect(cb.getState()).toBe('HALF_OPEN');

    // First half-open call — this one succeeds, consuming the one allowed call
    // To test the limit rejection, we need the first call to fail (re-opens)
    // or we need halfOpenMaxCalls=1 and a slow promise.
    // Let's use a different approach: set halfOpenMaxCalls to 0 so any call is rejected.
    vi.useRealTimers();

    const cb2 = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 10, halfOpenMaxCalls: 0 });
    await cb2.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 20));
    expect(cb2.getState()).toBe('HALF_OPEN');

    await expect(cb2.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker half-open limit reached',
    );
  });
});
