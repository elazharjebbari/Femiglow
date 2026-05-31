/**
 * Tests unit `audit.ts` — insert et list.
 *
 * En mode memory (drizzle null), auditMappingChange est no-op silencieux
 * (best-effort). listAuditForVersion retourne [] dans ce mode.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/client')>();
  return {
    ...actual,
    db: () => null,
  };
});

import { auditMappingChange, listAuditForVersion } from './audit';

describe('auditMappingChange', () => {
  it('no-op silencieux en mode memory (drizzle null)', async () => {
    await expect(
      auditMappingChange({
        versionId: 'emv_test',
        action: 'create',
        actorId: 'adm_test',
        meta: { source: 'default' },
      }),
    ).resolves.toBeUndefined();
  });

  it('accepte tous les types d\'action', async () => {
    const actions: Array<'create' | 'edit' | 'activate' | 'archive' | 'delete' | 'restore' | 'duplicate' | 'reset_to_default' | 'export_gtm' | 'test_event'> = [
      'create',
      'edit',
      'activate',
      'archive',
      'delete',
      'restore',
      'duplicate',
      'reset_to_default',
      'export_gtm',
      'test_event',
    ];
    for (const action of actions) {
      await expect(
        auditMappingChange({ versionId: 'x', action, actorId: 'adm', meta: {} }),
      ).resolves.toBeUndefined();
    }
  });

  it('accepte before/after JSONB optionnels', async () => {
    await expect(
      auditMappingChange({
        versionId: 'emv',
        action: 'edit',
        actorId: 'adm',
        before: { mappings: { x: 1 } },
        after: { mappings: { x: 2 } },
      }),
    ).resolves.toBeUndefined();
  });

  it('accepte ip_anonymized et ua_hash optionnels', async () => {
    await expect(
      auditMappingChange({
        versionId: 'emv',
        action: 'activate',
        actorId: 'adm',
        ipAnonymized: '192.168.0.0/16',
        uaHash: 'sha256:abc',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('listAuditForVersion', () => {
  it('retourne [] en mode memory', async () => {
    const r = await listAuditForVersion('emv_test');
    expect(r).toEqual([]);
  });

  it('accepte un opts.limit', async () => {
    const r = await listAuditForVersion('emv_test', { limit: 10 });
    expect(Array.isArray(r)).toBe(true);
  });
});
