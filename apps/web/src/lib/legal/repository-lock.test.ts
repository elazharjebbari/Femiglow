/**
 * Tests unitaires — `updateLegalPageWithLock` (optimistic locking via
 * `updatedAt` epoch).
 *
 * On mocke `db()` du client Drizzle pour intercepter les chaînes
 * select/update et simuler des états DB. La fonction sous test fait un
 * SELECT (via `getLegalPageBySlug`), check du token, puis UPDATE.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
  schema: { legalPages: {} },
}));

vi.mock('@/lib/ids', () => ({
  createId: (p: string) => `${p}_test`,
}));

import { db } from '@/lib/db/client';
import { updateLegalPageWithLock } from './repository';

const NOW = new Date('2026-05-13T12:00:00Z');

interface FakeConn {
  select: () => { from: () => { where: () => { limit: (n: number) => Promise<unknown[]> } } };
  update: () => {
    set: () => { where: () => { returning: () => Promise<unknown[]> } };
  };
}

function fakeConn(opts: {
  selectRows?: unknown[];
  updateRows?: unknown[];
}): FakeConn {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => opts.selectRows ?? [] }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: async () => opts.updateRows ?? [] }),
      }),
    }),
  };
}

beforeEach(() => {
  vi.mocked(db).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('updateLegalPageWithLock', () => {
  it('renvoie not_found si la page n\'existe pas', async () => {
    vi.mocked(db).mockReturnValue(fakeConn({ selectRows: [] }) as never);
    const r = await updateLegalPageWithLock('inconnue', { title: 'X' });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('renvoie version_conflict si expectedUpdatedAt diffère', async () => {
    vi.mocked(db).mockReturnValue(
      fakeConn({
        selectRows: [{ slug: 'cgv', updatedAt: NOW }],
      }) as never,
    );
    const r = await updateLegalPageWithLock('cgv', {
      title: 'X',
      expectedUpdatedAt: NOW.getTime() - 60_000, // obsolète
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('version_conflict');
      expect(r.currentUpdatedAt).toEqual(NOW);
    }
  });

  it('applique l\'update si expectedUpdatedAt matche', async () => {
    const updated = { slug: 'cgv', title: 'X', updatedAt: new Date(NOW.getTime() + 1000) };
    vi.mocked(db).mockReturnValue(
      fakeConn({
        selectRows: [{ slug: 'cgv', updatedAt: NOW }],
        updateRows: [updated],
      }) as never,
    );
    const r = await updateLegalPageWithLock('cgv', {
      title: 'X',
      expectedUpdatedAt: NOW.getTime(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.page).toEqual(updated);
  });

  it('applique l\'update sans check si expectedUpdatedAt omis', async () => {
    const updated = { slug: 'cgv', title: 'X', updatedAt: NOW };
    vi.mocked(db).mockReturnValue(
      fakeConn({
        selectRows: [{ slug: 'cgv', updatedAt: NOW }],
        updateRows: [updated],
      }) as never,
    );
    const r = await updateLegalPageWithLock('cgv', { title: 'X' });
    expect(r.ok).toBe(true);
  });

  it('renvoie not_found si l\'update échoue (concurrent delete)', async () => {
    vi.mocked(db).mockReturnValue(
      fakeConn({
        selectRows: [{ slug: 'cgv', updatedAt: NOW }],
        updateRows: [],
      }) as never,
    );
    const r = await updateLegalPageWithLock('cgv', { title: 'X' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});
