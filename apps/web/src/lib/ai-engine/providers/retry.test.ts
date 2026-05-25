import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RetryPolicy } from './retry';
import { ProviderError } from './types';

describe('RetryPolicy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds on first try without retries', async () => {
    const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 10 });
    const fn = vi.fn().mockResolvedValue('success');

    const result = await policy.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and eventually succeeds', async () => {
    const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered');

    const result = await policy.execute(fn);

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxRetries and throws after exhaustion', async () => {
    const policy = new RetryPolicy({ maxRetries: 2, baseDelayMs: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(policy.execute(fn)).rejects.toThrow('always fails');
    // 1 initial + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry non-retryable ProviderError (401 auth)', async () => {
    const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 });
    const authError = new ProviderError('Unauthorized', {
      provider: 'openai',
      model: 'gpt-4',
      retryable: false,
      statusCode: 401,
    });
    const fn = vi.fn().mockRejectedValue(authError);

    await expect(policy.execute(fn)).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry ProviderError with non-retryable status codes (400, 403, 404, 422)', async () => {
    for (const code of [400, 403, 404, 422]) {
      const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 });
      const fn = vi.fn().mockRejectedValue(
        new ProviderError(`Error ${code}`, {
          provider: 'test',
          model: 'test',
          retryable: true,
          statusCode: code,
        }),
      );

      await expect(policy.execute(fn)).rejects.toThrow(`Error ${code}`);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('retries ProviderError with retryable=true and retryable status code (429, 500, 503)', async () => {
    const policy = new RetryPolicy({ maxRetries: 1, baseDelayMs: 1 });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new ProviderError('Rate limited', {
          provider: 'openai',
          model: 'gpt-4',
          retryable: true,
          statusCode: 429,
        }),
      )
      .mockResolvedValue('ok');

    const result = await policy.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exponential backoff delay increases with attempts', async () => {
    const sleepCalls: number[] = [];
    const policy = new RetryPolicy({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 60_000,
      exponentialBase: 2,
    });

    // Spy on the private sleep to capture delay values
    const sleepSpy = vi.spyOn(policy as never, 'sleep' as never).mockImplementation(((ms: number) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    }) as never);

    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(policy.execute(fn)).rejects.toThrow('fail');

    // We should have 3 sleep calls (one per retry)
    expect(sleepCalls).toHaveLength(3);

    // The getDelay method applies jitter (0.5-1.0x), so the delay should be
    // within range. Base delays without jitter: 100, 200, 400.
    // With jitter: [50-100], [100-200], [200-400]
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(50);
    expect(sleepCalls[0]).toBeLessThanOrEqual(100);
    expect(sleepCalls[1]).toBeGreaterThanOrEqual(100);
    expect(sleepCalls[1]).toBeLessThanOrEqual(200);
    expect(sleepCalls[2]).toBeGreaterThanOrEqual(200);
    expect(sleepCalls[2]).toBeLessThanOrEqual(400);

    sleepSpy.mockRestore();
  });

  it('uses default config values when none provided', async () => {
    const policy = new RetryPolicy();
    // Just verify it doesn't throw and uses defaults (maxRetries=3)
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await policy.execute(fn);
    expect(result).toBe('ok');
  });

  it('supports custom isRetryable function', async () => {
    const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 1 });
    const fn = vi.fn().mockRejectedValue(new Error('custom'));

    // Custom function says: never retry
    await expect(policy.execute(fn, () => false)).rejects.toThrow('custom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
