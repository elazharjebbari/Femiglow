import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkIdempotency,
  IdempotencyConflictError,
  markProcessing,
  storeResult,
  withIdempotency,
} from './idempotency';
import { redis } from './client';

beforeEach(() => {
  redis.__resetMemoryStore();
  vi.restoreAllMocks();
});

describe('checkIdempotency', () => {
  it('fresh key → status fresh', async () => {
    const r = await checkIdempotency('/api/test', 'key-1');
    expect(r.status).toBe('fresh');
  });

  it('empty key → status fresh (no-op)', async () => {
    const r = await checkIdempotency('/api/test', '');
    expect(r.status).toBe('fresh');
  });

  it('after markProcessing → status processing', async () => {
    await markProcessing('/api/test', 'key-2');
    const r = await checkIdempotency('/api/test', 'key-2');
    expect(r.status).toBe('processing');
  });

  it('after storeResult success → status completed avec cached result', async () => {
    await storeResult('/api/test', 'key-3', { success: { orderId: 'abc' } }, 100);
    const r = await checkIdempotency<{ orderId: string }>('/api/test', 'key-3');
    expect(r.status).toBe('completed');
    expect(r.cachedResult).toEqual({ orderId: 'abc' });
    expect(r.cachedLatencyMs).toBe(100);
  });

  it('after storeResult error → status failed avec cached error', async () => {
    await storeResult('/api/test', 'key-4', { error: 'Boom!' }, 50);
    const r = await checkIdempotency('/api/test', 'key-4');
    expect(r.status).toBe('failed');
    expect(r.cachedError).toBe('Boom!');
  });
});

describe('withIdempotency — fresh exécute', () => {
  it('fresh key → fn() exécutée + résultat caché', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 42 });
    const result = await withIdempotency('/api/test', 'key-5', fn);
    expect(result).toEqual({ value: 42 });
    expect(fn).toHaveBeenCalledOnce();

    // Replay → fn NOT called
    fn.mockClear();
    const replay = await withIdempotency('/api/test', 'key-5', fn);
    expect(fn).not.toHaveBeenCalled();
    expect(replay).toEqual({ value: 42 });
  });

  it('clé vide → fn() exécutée à chaque appel (pas de cache)', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    await withIdempotency('/api/test', '', fn);
    await withIdempotency('/api/test', '', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withIdempotency — error replay', () => {
  it('fail → cached → replay throw same error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(withIdempotency('/api/test', 'key-6', fn)).rejects.toThrow('Network error');

    // Replay
    fn.mockClear();
    await expect(withIdempotency('/api/test', 'key-6', fn)).rejects.toThrow('Network error');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('withIdempotency — concurrent processing', () => {
  it('processing in progress → throw IdempotencyConflictError', async () => {
    await markProcessing('/api/test', 'key-7');
    const fn = vi.fn().mockResolvedValue('x');
    await expect(withIdempotency('/api/test', 'key-7', fn)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('withIdempotency — endpoints isolés', () => {
  it('même key sur 2 endpoints différents → indépendants', async () => {
    const fn1 = vi.fn().mockResolvedValue('a');
    const fn2 = vi.fn().mockResolvedValue('b');
    await withIdempotency('/api/orders', 'shared-key', fn1);
    await withIdempotency('/api/leads', 'shared-key', fn2);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });
});

describe('IdempotencyConflictError', () => {
  it('code = idempotency_conflict', () => {
    const err = new IdempotencyConflictError('msg');
    expect(err.code).toBe('idempotency_conflict');
    expect(err.name).toBe('IdempotencyConflictError');
  });
});
