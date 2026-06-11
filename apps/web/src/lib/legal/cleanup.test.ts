/**
 * LEGAL-V2 — Test de cleanupLegalE2E business logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockChain: any = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  delete: vi.fn(),
  returning: vi.fn(),
};

vi.mock('@/lib/db/client', () => ({
  db: () => ({
    select: () => mockChain,
    delete: () => mockChain,
  }),
  schema: { legalPages: { slug: 'slug', status: 'status', createdAt: 'createdAt', id: 'id' } },
}));

import { cleanupLegalE2E } from './cleanup';

describe('cleanupLegalE2E', () => {
  beforeEach(() => {
    Object.keys(mockChain).forEach((k) => {
      if (typeof mockChain[k] === 'function') {
        mockChain[k].mockReset();
        mockChain[k].mockReturnValue(mockChain);
      }
    });
  });

  it('rejette olderThanDays < 7', async () => {
    await expect(
      cleanupLegalE2E({ dryRun: true, olderThanDays: 3 }),
    ).rejects.toThrow(/safety guard/);
  });

  it('rejette olderThanDays = 0', async () => {
    await expect(
      cleanupLegalE2E({ dryRun: true, olderThanDays: 0 }),
    ).rejects.toThrow();
  });

  it('dryRun retourne candidates sans muter', async () => {
    mockChain.where.mockResolvedValueOnce([{ value: 5 }]);
    const result = await cleanupLegalE2E({ dryRun: true, olderThanDays: 7 });
    expect(result.candidates).toBe(5);
    expect(result.deleted).toBe(0);
    expect(result.dryRun).toBe(true);
  });

  it('utilise slug LIKE e2e-test-% et status draft', async () => {
    mockChain.where.mockResolvedValueOnce([{ value: 0 }]);
    const result = await cleanupLegalE2E({ dryRun: true, olderThanDays: 7 });
    expect(result.criteria.slugLike).toBe('e2e-test-%');
    expect(result.criteria.status).toBe('draft');
    expect(result.criteria.olderThanDays).toBe(7);
  });

  it('execute supprime les rows', async () => {
    // First call (count) : where() retourne array (terminal)
    // Second call (delete) : where() chainable → returning() retourne array
    let callIndex = 0;
    mockChain.where.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // count path : where est terminal
        return Promise.resolve([{ value: 3 }]);
      }
      // delete path : where chaîne vers returning
      return mockChain;
    });
    mockChain.returning.mockResolvedValueOnce([
      { id: 'lp_1' }, { id: 'lp_2' }, { id: 'lp_3' },
    ]);
    const result = await cleanupLegalE2E({ dryRun: false, olderThanDays: 7 });
    expect(result.candidates).toBe(3);
    expect(result.deleted).toBe(3);
  });
});
