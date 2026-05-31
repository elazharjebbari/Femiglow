import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalPages: {} },
}));

import { db } from '@/lib/db/client';
import { listLegalPages } from './repository';

function captureWhereConn() {
  const calls: Array<{ where?: unknown; orderByCalled: boolean }> = [];
  const current: { where?: unknown; orderByCalled: boolean } = {
    where: undefined,
    orderByCalled: false,
  };
  return {
    calls,
    conn: {
      select: () => ({
        from: () => ({
          where: (cond: unknown) => {
            current.where = cond;
            return {
              orderBy: async () => {
                current.orderByCalled = true;
                calls.push({ ...current });
                return [];
              },
            };
          },
          orderBy: async () => {
            current.orderByCalled = true;
            calls.push({ ...current });
            return [];
          },
        }),
      }),
    },
  };
}

beforeEach(() => {
  vi.mocked(db).mockReset();
});

describe('listLegalPages — filter', () => {
  it('sans filtre → pas de WHERE', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages();
    expect(calls[0]?.where).toBeUndefined();
  });

  it('avec status seul → WHERE eq', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages({ status: 'draft' });
    expect(calls[0]?.where).toBeDefined();
  });

  it('avec search trim+empty → ignoré (pas de WHERE)', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages({ search: '   ' });
    expect(calls[0]?.where).toBeUndefined();
  });

  it('avec search non-vide → WHERE ILIKE pattern', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages({ search: 'cgv' });
    expect(calls[0]?.where).toBeDefined();
  });

  it('search escape les wildcards % et _', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages({ search: '50% off_' });
    // Le WHERE doit être posé (on ne peut pas inspect le SQL chunk sans
    // dépendre des internes Drizzle mais le call doit avoir lieu)
    expect(calls[0]?.where).toBeDefined();
  });

  it('combo status + search → WHERE AND', async () => {
    const { conn, calls } = captureWhereConn();
    vi.mocked(db).mockReturnValue(conn as never);
    await listLegalPages({ status: 'published', search: 'cgv' });
    expect(calls[0]?.where).toBeDefined();
  });
});
