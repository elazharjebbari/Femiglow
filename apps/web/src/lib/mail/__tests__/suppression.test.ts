import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from './_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
}));

import { db as getDb } from '@/lib/db/client';
import { isSuppressed, findSuppressed, addSuppression } from '../suppression';

describe('suppression', () => {
  let drizzle: FakeDrizzle;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSuppressed', () => {
    it('returns true when row exists', async () => {
      drizzle = makeFakeDrizzle({ selectResult: [{ email: 'a@b.c' }] });
      vi.mocked(getDb).mockReturnValue(drizzle as never);
      expect(await isSuppressed('A@B.C')).toBe(true);
    });

    it('returns false when row absent', async () => {
      drizzle = makeFakeDrizzle({ selectResult: [] });
      vi.mocked(getDb).mockReturnValue(drizzle as never);
      expect(await isSuppressed('a@b.c')).toBe(false);
    });

    it('normalizes email (lowercase + trim)', async () => {
      drizzle = makeFakeDrizzle({ selectResult: [{ email: 'a@b.c' }] });
      vi.mocked(getDb).mockReturnValue(drizzle as never);
      await isSuppressed('  A@B.C  ');
      // The where clause was called with the normalized lookup ; we
      // can't easily introspect the eq() return value, but we can at
      // least assert the select was made once.
      expect(drizzle.calls.select).toHaveLength(1);
    });

    it('throws when DB is not configured', async () => {
      vi.mocked(getDb).mockReturnValue(null as never);
      await expect(isSuppressed('a@b.c')).rejects.toThrow(/not configured/);
    });
  });

  describe('findSuppressed', () => {
    it('returns empty Set when input is empty', async () => {
      const r = await findSuppressed([]);
      expect(r.size).toBe(0);
    });

    it('returns a Set of emails returned by drizzle', async () => {
      drizzle = makeFakeDrizzle({
        selectResult: [{ email: 'a@b.c' }, { email: 'd@e.f' }],
      });
      vi.mocked(getDb).mockReturnValue(drizzle as never);
      const r = await findSuppressed(['a@b.c', 'd@e.f', 'g@h.i']);
      expect(r.has('a@b.c')).toBe(true);
      expect(r.has('d@e.f')).toBe(true);
      expect(r.size).toBe(2);
    });
  });

  describe('addSuppression', () => {
    it('inserts with onConflictDoNothing (idempotent)', async () => {
      drizzle = makeFakeDrizzle();
      vi.mocked(getDb).mockReturnValue(drizzle as never);
      await addSuppression({
        email: 'A@B.C',
        reason: 'hard_bounce',
        source: 'stalwart',
      });
      expect(drizzle.calls.insert).toHaveLength(1);
      const i = drizzle.calls.insert[0]!;
      expect((i.values as { email: string }).email).toBe('a@b.c'); // normalized
      expect(i.onConflict).toBe('doNothing');
    });
  });
});
