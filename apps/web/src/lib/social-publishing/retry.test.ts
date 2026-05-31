import { describe, expect, it, vi } from 'vitest';
import { isTransientHttpStatus, normalizeRetryPolicy, withRetry } from './retry';

describe('social publishing retry', () => {
  it('borne les tentatives', () => {
    expect(normalizeRetryPolicy({ attempts: 0 }).attempts).toBe(1);
    expect(normalizeRetryPolicy({ attempts: 99 }).attempts).toBe(5);
  });

  it('retry les erreurs explicitement retryables', async () => {
    let count = 0;
    const result = await withRetry(
      async () => {
        count += 1;
        if (count < 3) throw new Error('temporary');
        return 'ok';
      },
      { attempts: 3, delaysMs: [0], shouldRetry: () => true },
    );
    expect(result).toBe('ok');
    expect(count).toBe(3);
  });

  it('appelle onRetry avec le délai choisi', async () => {
    const onRetry = vi.fn();
    await expect(
      withRetry(async () => { throw new Error('temporary'); }, { attempts: 2, delaysMs: [0], shouldRetry: () => true, onRetry }),
    ).rejects.toThrow('temporary');
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 0 }));
  });

  it('détecte les statuts HTTP transitoires', () => {
    expect(isTransientHttpStatus(429)).toBe(true);
    expect(isTransientHttpStatus(502)).toBe(true);
    expect(isTransientHttpStatus(401)).toBe(false);
  });
});
