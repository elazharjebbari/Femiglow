/**
 * Tests purge engine.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { purgeExpiredSnapshots } from './purge';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('purgeExpiredSnapshots', () => {
  it('returns purged=0 when no snapshots expired', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 0 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await purgeExpiredSnapshots();
    expect(result.purged).toBe(0);
    expect(drizzle.calls.delete).toHaveLength(0);
  });

  it('deletes when snapshots are expired', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 47 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await purgeExpiredSnapshots();
    expect(result.purged).toBe(47);
    expect(drizzle.calls.delete).toHaveLength(1);
  });

  it('reports durationMs', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 0 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const result = await purgeExpiredSnapshots();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(purgeExpiredSnapshots()).rejects.toThrow(/not configured/i);
  });
});
