// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const store = new Map<string, { requestHash: string; responseJson: unknown; responseStatus: number; resourceId: string | null }>();

vi.mock('../repos/idempotency-repo', async (orig) => {
  const real = await orig<typeof import('../repos/idempotency-repo')>();
  return {
    ...real,
    idempotencyRepo: {
      lookup: vi.fn(async (key: string, scope: string, hash: string) => {
        const row = store.get(`${key}|${scope}`);
        if (!row) return null;
        if (row.responseStatus >= 400) return null;
        if (row.requestHash !== hash) return { match: false, conflict: true };
        return { match: true, hit: row };
      }),
      store: vi.fn(async (r: { key: string; scope: string; requestHash: string; responseJson: unknown; responseStatus: number; resourceId?: string | null }) => {
        store.set(`${r.key}|${r.scope}`, { ...r, resourceId: r.resourceId ?? null });
      }),
    },
  };
});

import { isReplayableStatus, withIdempotency } from './idempotency-middleware';
import { idempotencyRepo } from '../repos/idempotency-repo';

const req = () =>
  new NextRequest('https://femiglow-maroc.com/api/checkout/order', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'idem_test_key_123' },
  });

describe('idempotence : les erreurs ne sont jamais rejouées', () => {
  beforeEach(() => {
    store.clear();
    vi.mocked(idempotencyRepo.store).mockClear();
  });

  it('isReplayableStatus', () => {
    expect([200, 201, 204, 302].every(isReplayableStatus)).toBe(true);
    expect([400, 404, 409, 422, 429, 500].some(isReplayableStatus)).toBe(false);
  });

  it('409 stock puis remise en stock : le second essai (même clé) ré-exécute et réussit', async () => {
    let stock = 0;
    const execute = async () =>
      stock > 0
        ? { status: 201, body: { orderId: 'o_1' } as unknown, resourceId: 'o_1' }
        : { status: 409, body: { error: { code: 'stock_insufficient' } } as unknown, resourceId: null };

    const first = await withIdempotency({ request: req(), scope: 'order_create', payload: { a: 1 }, execute });
    expect(first.status).toBe(409);
    expect(idempotencyRepo.store).not.toHaveBeenCalled();

    stock = 500;
    const second = await withIdempotency({ request: req(), scope: 'order_create', payload: { a: 1 }, execute });
    expect(second).toMatchObject({ status: 201, replayed: false });

    // Le succès, lui, est bien rejoué.
    const third = await withIdempotency({ request: req(), scope: 'order_create', payload: { a: 1 }, execute: vi.fn() });
    expect(third).toMatchObject({ status: 201, replayed: true });
  });

  it('422 prix : non persisté', async () => {
    await withIdempotency({
      request: req(),
      scope: 'order_create',
      payload: {},
      execute: async () => ({ status: 422, body: {} as unknown }),
    });
    expect(idempotencyRepo.store).not.toHaveBeenCalled();
  });
});
