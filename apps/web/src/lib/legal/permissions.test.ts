import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
}));

vi.mock('@/lib/db/schema', () => ({
  adminUsers: {},
}));

import { db } from '@/lib/db/client';
import { getAdminRole, hasPermission, requireLegalPermission } from './permissions';
import type { AdminSession } from '@/lib/auth/session';

const session: AdminSession = {
  adminId: 'adm_p',
  email: 'p@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

beforeEach(() => {
  vi.mocked(db).mockReset();
});

describe('getAdminRole', () => {
  it('fallback superadmin si pas de DB', async () => {
    vi.mocked(db).mockReturnValue(null);
    expect(await getAdminRole('adm_x')).toBe('superadmin');
  });

  it('fallback superadmin si rôle inexistant en DB', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [] }),
    } as never);
    expect(await getAdminRole('adm_x')).toBe('superadmin');
  });

  it('fallback superadmin si rôle invalide', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [{ role: 'hacker' }] }),
    } as never);
    expect(await getAdminRole('adm_x')).toBe('superadmin');
  });

  it('retourne le rôle valide depuis DB', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [{ role: 'viewer' }] }),
    } as never);
    expect(await getAdminRole('adm_x')).toBe('viewer');
  });

  it('catch les erreurs (table sans colonne role) → superadmin fallback', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => {
        throw new Error('column role does not exist');
      },
    } as never);
    expect(await getAdminRole('adm_x')).toBe('superadmin');
  });
});

describe('hasPermission', () => {
  it('superadmin a tout sur legal', () => {
    expect(hasPermission('superadmin', 'legal', 'read')).toBe(true);
    expect(hasPermission('superadmin', 'legal', 'write')).toBe(true);
    expect(hasPermission('superadmin', 'legal', 'publish')).toBe(true);
    expect(hasPermission('superadmin', 'legal', 'delete')).toBe(true);
  });

  it('admin a read/write/publish, PAS delete sur legal', () => {
    expect(hasPermission('admin', 'legal', 'read')).toBe(true);
    expect(hasPermission('admin', 'legal', 'write')).toBe(true);
    expect(hasPermission('admin', 'legal', 'publish')).toBe(true);
    expect(hasPermission('admin', 'legal', 'delete')).toBe(false);
  });

  it('editor a read/write, PAS publish ni delete', () => {
    expect(hasPermission('editor', 'legal', 'read')).toBe(true);
    expect(hasPermission('editor', 'legal', 'write')).toBe(true);
    expect(hasPermission('editor', 'legal', 'publish')).toBe(false);
    expect(hasPermission('editor', 'legal', 'delete')).toBe(false);
  });

  it('viewer a uniquement read', () => {
    expect(hasPermission('viewer', 'legal', 'read')).toBe(true);
    expect(hasPermission('viewer', 'legal', 'write')).toBe(false);
    expect(hasPermission('viewer', 'legal', 'publish')).toBe(false);
    expect(hasPermission('viewer', 'legal', 'delete')).toBe(false);
  });
});

describe('requireLegalPermission', () => {
  it('superadmin → no throw pour toutes actions', async () => {
    vi.mocked(db).mockReturnValue(null); // → fallback superadmin
    await expect(requireLegalPermission('write', session)).resolves.toBeUndefined();
    await expect(requireLegalPermission('publish', session)).resolves.toBeUndefined();
    await expect(requireLegalPermission('delete', session)).resolves.toBeUndefined();
  });

  it('viewer → throw forbidden sur write', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [{ role: 'viewer' }] }),
    } as never);
    await expect(requireLegalPermission('write', session)).rejects.toThrow(/Permission refusée/);
  });

  it('admin → throw forbidden sur delete', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [{ role: 'admin' }] }),
    } as never);
    await expect(requireLegalPermission('delete', session)).rejects.toThrow(/admin/);
  });

  it('editor → no throw sur write, throw sur publish', async () => {
    vi.mocked(db).mockReturnValue({
      execute: async () => ({ rows: [{ role: 'editor' }] }),
    } as never);
    await expect(requireLegalPermission('write', session)).resolves.toBeUndefined();
    await expect(requireLegalPermission('publish', session)).rejects.toThrow(/publish/);
  });
});
