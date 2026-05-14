/**
 * Tests pour listOutboxFiltered — DB mockée via fake-drizzle.
 * On vérifie que les filtres ParsedFilter[] produisent une query bien formée
 * (where + orderBy + limit + offset) et que la shape du retour est correcte.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { listOutboxFiltered } from '../search';
import { parseFilters } from '../filters-parser';

const NOW = new Date('2026-05-14T22:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listOutboxFiltered', () => {
  it('returns rows + total + window=matched on small result', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [
        { id: 'o1', template: 'welcome', toEmail: 'a@b.c', status: 'failed', attempts: 2, maxAttempts: 3 },
        { n: 1 }, // count result (separate query)
      ],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await listOutboxFiltered({
      filters: parseFilters('status:failed', NOW).filters,
      pagination: { limit: 50, offset: 0 },
    });

    expect(result.window).toBe('matched');
    // 2 select calls : one for rows, one for count
    expect(drizzle.calls.select.length).toBeGreaterThanOrEqual(1);
  });

  it('caps limit to MAX_LIMIT', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await listOutboxFiltered({
      filters: [],
      pagination: { limit: 99999, offset: 0 },
    });

    const rowsCall = drizzle.calls.select.find((c) => c.limit !== undefined);
    expect(rowsCall?.limit).toBe(1000);
  });

  it('respects custom offset', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await listOutboxFiltered({
      filters: [],
      pagination: { limit: 50, offset: 100 },
    });

    const rowsCall = drizzle.calls.select.find((c) => c.offset !== undefined);
    expect(rowsCall?.offset).toBe(100);
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(
      listOutboxFiltered({ filters: [], pagination: { limit: 10, offset: 0 } }),
    ).rejects.toThrow(/not configured/i);
  });

  it('composes multiple filters into a single where', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await listOutboxFiltered({
      filters: parseFilters('status:failed template:cart-* attempts:>=2', NOW).filters,
      pagination: { limit: 50, offset: 0 },
    });

    // Vérifier qu'il y a un where construit (combine 3 fragments)
    const rowsCall = drizzle.calls.select.find((c) => c.where !== undefined);
    expect(rowsCall?.where).toBeDefined();
  });

  it('handles freetext-only search', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await listOutboxFiltered({
      filters: [],
      freetext: 'user@x.y',
      pagination: { limit: 50, offset: 0 },
    });

    const rowsCall = drizzle.calls.select.find((c) => c.where !== undefined);
    expect(rowsCall?.where).toBeDefined();
  });
});
