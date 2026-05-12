/**
 * CHA-232 — Tests du helper server-side `getShippingConfig`.
 *
 * On mocke `getSection` du resolver admin-config pour simuler les trois cas :
 *  - flag présent (true / false) → respecté.
 *  - flag absent → fallback true (offerte par défaut).
 *  - erreur (cascade qui throw) → fallback true.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin-config/resolve', () => ({
  getSection: vi.fn(),
}));

import { getSection } from '@/lib/admin-config/resolve';
import { getShippingConfig } from './shipping-config';

beforeEach(() => {
  vi.mocked(getSection).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getShippingConfig', () => {
  it('retourne freeShipping=true quand le flag DB vaut true', async () => {
    vi.mocked(getSection).mockResolvedValue({
      section: 'flags',
      payload: { flags: { freeShipping: true, foo: false } },
      meta: {
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        isDefault: false,
      },
    } as never);
    await expect(getShippingConfig()).resolves.toEqual({
      freeShipping: true,
    });
  });

  it('retourne freeShipping=false quand le flag DB vaut false', async () => {
    vi.mocked(getSection).mockResolvedValue({
      section: 'flags',
      payload: { flags: { freeShipping: false } },
      meta: {
        version: 2,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        isDefault: false,
      },
    } as never);
    await expect(getShippingConfig()).resolves.toEqual({
      freeShipping: false,
    });
  });

  it('fallback freeShipping=true si le flag est absent du payload', async () => {
    vi.mocked(getSection).mockResolvedValue({
      section: 'flags',
      payload: { flags: { other: true } },
      meta: {
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        isDefault: false,
      },
    } as never);
    await expect(getShippingConfig()).resolves.toEqual({
      freeShipping: true,
    });
  });

  it('fallback freeShipping=true si la cascade throw', async () => {
    vi.mocked(getSection).mockRejectedValue(new Error('db down'));
    await expect(getShippingConfig()).resolves.toEqual({
      freeShipping: true,
    });
  });
});
