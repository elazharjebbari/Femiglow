/**
 * Tests du helper server-side `getMenuHintEnabled`.
 *
 * On mocke `getSection` du resolver admin-config pour couvrir :
 *  - flag présent (true / false) → respecté.
 *  - flag absent → fallback false (indice OFF par défaut).
 *  - erreur (cascade qui throw) → fallback false.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-config/resolve', () => ({
  getSection: vi.fn(),
}));

import { getSection } from '@/lib/admin-config/resolve';
import { getMenuHintEnabled } from './menu-hint-config';

function flagsRow(flags: Record<string, boolean>) {
  return {
    section: 'flags',
    payload: { flags },
    meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      isDefault: false,
    },
  } as never;
}

beforeEach(() => {
  vi.mocked(getSection).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getMenuHintEnabled', () => {
  it('retourne true quand le flag DB vaut true', async () => {
    vi.mocked(getSection).mockResolvedValue(flagsRow({ menuHintEnabled: true }));
    await expect(getMenuHintEnabled()).resolves.toBe(true);
  });

  it('retourne false quand le flag DB vaut false', async () => {
    vi.mocked(getSection).mockResolvedValue(flagsRow({ menuHintEnabled: false }));
    await expect(getMenuHintEnabled()).resolves.toBe(false);
  });

  it('fallback false si le flag est absent du payload', async () => {
    vi.mocked(getSection).mockResolvedValue(flagsRow({ freeShipping: true }));
    await expect(getMenuHintEnabled()).resolves.toBe(false);
  });

  it('fallback false si la cascade throw', async () => {
    vi.mocked(getSection).mockRejectedValue(new Error('db down'));
    await expect(getMenuHintEnabled()).resolves.toBe(false);
  });
});
