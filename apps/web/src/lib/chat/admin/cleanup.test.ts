/**
 * CHA-LEAD-V2 — Test de cleanupGhosts() business logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectChain = {
  from: vi.fn(),
};
const mockUpdateChain = {
  set: vi.fn(),
};

vi.mock('../db/client', () => ({
  requireChatDb: () => ({
    select: vi.fn(() => mockSelectChain),
    update: vi.fn(() => mockUpdateChain),
  }),
}));

import { cleanupGhosts } from './cleanup';

describe('cleanupGhosts()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejette olderThanDays < 7 (safety guard)', async () => {
    await expect(
      cleanupGhosts({ dryRun: true, olderThanDays: 3 }),
    ).rejects.toThrow(/safety guard/);
  });

  it('rejette olderThanDays = 0', async () => {
    await expect(
      cleanupGhosts({ dryRun: true, olderThanDays: 0 }),
    ).rejects.toThrow();
  });

  it('accepte olderThanDays = 7 (limite basse)', async () => {
    mockSelectChain.from = vi.fn(() => ({
      where: () => Promise.resolve([{ value: 0 }]),
    }));
    const result = await cleanupGhosts({ dryRun: true, olderThanDays: 7 });
    expect(result.candidates).toBe(0);
    expect(result.archived).toBe(0);
  });

  it('dryRun retourne candidates sans muter', async () => {
    mockSelectChain.from = vi.fn(() => ({
      where: () => Promise.resolve([{ value: 42 }]),
    }));
    const result = await cleanupGhosts({ dryRun: true, olderThanDays: 30 });
    expect(result.candidates).toBe(42);
    expect(result.archived).toBe(0);
    expect(result.dryRun).toBe(true);
    expect(mockUpdateChain.set).not.toHaveBeenCalled();
  });

  it('utilise kinds=["wizard_pivot"] par défaut', async () => {
    mockSelectChain.from = vi.fn(() => ({
      where: () => Promise.resolve([{ value: 5 }]),
    }));
    const result = await cleanupGhosts({ dryRun: true, olderThanDays: 30 });
    expect(result.criteria.kinds).toEqual(['wizard_pivot']);
    expect(result.criteria.withoutLead).toBe(true);
    expect(result.criteria.olderThanDays).toBe(30);
  });

  it('respecte kinds override', async () => {
    mockSelectChain.from = vi.fn(() => ({
      where: () => Promise.resolve([{ value: 5 }]),
    }));
    const result = await cleanupGhosts({
      dryRun: true,
      olderThanDays: 30,
      kinds: ['system', 'wizard_pivot'],
    });
    expect(result.criteria.kinds).toEqual(['system', 'wizard_pivot']);
  });
});
