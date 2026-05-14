/**
 * Tests bulkRetry + bulkSuppress.
 *
 * Cas couverts : éligibilité par status, IDs not found, > MAX_BULK_SIZE,
 * idempotency (retry sur un id déjà pending), insert suppression bulk +
 * ON CONFLICT DO NOTHING, update outbox.status='suppressed'.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { bulkRetry, bulkSuppress } from '../bulk-actions';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bulkRetry', () => {
  it('returns zero counts on empty input', async () => {
    const result = await bulkRetry([]);
    expect(result).toEqual({ retried: 0, skipped: 0, skippedIds: [] });
  });

  it('throws on input > MAX_BULK_SIZE', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    await expect(bulkRetry(ids)).rejects.toThrow(/500/);
  });

  it('retries only eligible rows (status failed/dlq/bounced_soft)', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [
        { id: 'eligible-1', status: 'failed' },
        { id: 'eligible-2', status: 'dlq' },
        { id: 'eligible-3', status: 'bounced_soft' },
        { id: 'wrong-1', status: 'sent' },
        { id: 'wrong-2', status: 'pending' },
      ],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await bulkRetry([
      'eligible-1',
      'eligible-2',
      'eligible-3',
      'wrong-1',
      'wrong-2',
      'not-in-db',
    ]);

    expect(result.retried).toBe(3);
    expect(result.skipped).toBe(3);
    expect(result.skippedIds).toContainEqual({ id: 'wrong-1', reason: 'wrong_status' });
    expect(result.skippedIds).toContainEqual({ id: 'wrong-2', reason: 'wrong_status' });
    expect(result.skippedIds).toContainEqual({ id: 'not-in-db', reason: 'not_found' });
  });

  it('idempotent : second call ignores already-pending rows', async () => {
    // Premier appel : status='failed' → retry → DB devient 'pending'
    // Second appel : status='pending' → skipped
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'i1', status: 'pending' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await bulkRetry(['i1']);
    expect(result.retried).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedIds[0]).toEqual({ id: 'i1', reason: 'wrong_status' });
  });

  it('sets status=pending, attempts=0, nextRetry=now, lastError=null on eligible rows', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'i1', status: 'failed' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await bulkRetry(['i1']);

    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.status).toBe('pending');
    expect(set.attempts).toBe(0);
    expect(set.lastError).toBeNull();
    expect(set.nextRetry).toBeInstanceOf(Date);
    expect(set.updatedAt).toBeInstanceOf(Date);
  });

  it('skips update call entirely when no eligible rows', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'i1', status: 'sent' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await bulkRetry(['i1']);
    expect(drizzle.calls.update).toHaveLength(0);
  });
});

describe('bulkSuppress', () => {
  it('returns zero on empty', async () => {
    const result = await bulkSuppress([]);
    expect(result).toEqual({ suppressed: 0, skipped: 0 });
  });

  it('throws on > 500 ids', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    await expect(bulkSuppress(ids)).rejects.toThrow(/500/);
  });

  it('inserts suppression with reason=manual_admin by default', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [
        { id: 'o1', toEmail: 'Foo@Bar.C' },
        { id: 'o2', toEmail: 'BAZ@x.y' },
      ],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await bulkSuppress(['o1', 'o2']);

    expect(result.suppressed).toBe(2);
    expect(drizzle.calls.insert).toHaveLength(1);
    const values = drizzle.calls.insert[0]!.values as { email: string; reason: string; source: string }[];
    // Emails lowercased
    expect(values.map((v) => v.email)).toEqual(['foo@bar.c', 'baz@x.y']);
    expect(values[0]!.reason).toBe('manual_admin');
    expect(values[0]!.source).toBe('manual');
    expect(drizzle.calls.insert[0]!.onConflict).toBe('doNothing');
  });

  it('accepts custom reason hard_bounce', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'o1', toEmail: 'x@y.z' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await bulkSuppress(['o1'], 'hard_bounce');

    const values = drizzle.calls.insert[0]!.values as { reason: string }[];
    expect(values[0]!.reason).toBe('hard_bounce');
  });

  it('marks outbox rows as suppressed', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'o1', toEmail: 'x@y.z' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await bulkSuppress(['o1']);

    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.status).toBe('suppressed');
  });

  it('reports skipped count when DB returns fewer rows than requested', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'o1', toEmail: 'x@y.z' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await bulkSuppress(['o1', 'o2', 'o3']);
    expect(result.suppressed).toBe(1);
    expect(result.skipped).toBe(2);
  });
});
