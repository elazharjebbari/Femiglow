/**
 * N06 — resolve.ts : cascade DB → defaults → failsafe (section nav).
 *
 * DB absente → defaults (v0) ; DB valide → DB ; DB corrompue → failsafe defaults
 * + logger.warn ; badge isDefault structurel.
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N06.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: (...a: unknown[]) => unknown) => fn }));
const getAppConfigRow = vi.fn();
vi.mock('@/lib/db/queries/app-config', () => ({ getAppConfigRow: (...a: unknown[]) => getAppConfigRow(...a) }));
const warn = vi.fn();
vi.mock('@/lib/logging/logger', () => ({ logger: { warn: (...a: unknown[]) => warn(...a), info: vi.fn(), error: vi.fn() } }));

import { getSection } from './resolve';
import { navDefault } from './defaults';

beforeEach(() => {
  getAppConfigRow.mockReset();
  warn.mockReset();
});
afterEach(() => vi.clearAllMocks());

function row(payload: unknown, version = 3) {
  return { section: 'nav', payload, version, updatedAt: new Date('2026-06-01'), updatedBy: { id: 'a', email: 'a@x' } };
}

describe('N06 resolve nav cascade', () => {
  it('N06-I001 DB absente → defaults, version 0, isDefault true', async () => {
    getAppConfigRow.mockResolvedValue(null);
    const res = await getSection('nav');
    expect(res.payload).toEqual(navDefault);
    expect(res.meta.version).toBe(0);
    expect(res.meta.isDefault).toBe(true);
  });

  it('N06-I002 DB valide (= defaults) → payload DB, isDefault true (structurel)', async () => {
    getAppConfigRow.mockResolvedValue(row(navDefault, 5));
    const res = await getSection('nav');
    expect(res.payload).toEqual(navDefault);
    expect(res.meta.version).toBe(5);
    expect(res.meta.isDefault).toBe(true);
  });

  it('N06-I003 DB valide mais modifiée → isDefault false', async () => {
    const modified = { items: navDefault.items.slice(0, navDefault.items.length - 1) };
    getAppConfigRow.mockResolvedValue(row(modified, 7));
    const res = await getSection('nav');
    expect(res.meta.isDefault).toBe(false);
    expect((res.payload as typeof navDefault).items).toHaveLength(navDefault.items.length - 1);
  });

  it('N06-I004 DB corrompue → failsafe defaults + logger.warn', async () => {
    getAppConfigRow.mockResolvedValue(row({ items: [{ key: 'BAD KEY', label: 'x', href: '/admin/x', icon: 'box', position: 0 }] }, 9));
    const res = await getSection('nav');
    expect(res.payload).toEqual(navDefault); // failsafe
    expect(res.meta.isDefault).toBe(true);
    expect(warn).toHaveBeenCalledWith('admin_config.zod_fail', expect.objectContaining({ section: 'nav' }));
  });
});
