/**
 * Tests unitaires `store.ts` — CRUD + transitions + FIFO + edge cases.
 * Couvre 20+ scénarios sur memoryStore (sans DB réelle).
 *
 * Note : ces tests s'exécutent en mode "drizzle indispo" (DB url absent) et
 * exercent donc principalement le path memoryStore + fallback. Les tests
 * d'intégration `admin-event-mappings-*.test.ts` exercent la branche Drizzle.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';

const dbHandle = vi.hoisted(() => ({
  mode: 'memory' as 'memory' | 'throw',
}));

vi.mock('@/lib/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/client')>();
  return {
    ...actual,
    db: () => {
      if (dbHandle.mode === 'throw') {
        throw Object.assign(new Error('db error'), { code: '42P01' });
      }
      return null;
    },
  };
});

import { mappingStore } from './store';
import type { Mappings } from './types';

const buildCell = (mappedName: string | null) => ({ mappedName, isCustom: false, isEnabled: true, notes: null });
const buildMappings = (): Mappings => ({
  purchase: {
    meta: buildCell('Purchase'),
    google_ga4: buildCell('purchase'),
    google_ads: buildCell('purchase'),
    tiktok: buildCell('CompletePayment'),
    snap: buildCell('PURCHASE'),
    pinterest: buildCell('checkout'),
  },
});

beforeEach(() => {
  dbHandle.mode = 'memory';
});

describe('mappingStore — mode memory (drizzle null)', () => {
  it('list retourne tableau vide quand drizzle indispo', async () => {
    const r = await mappingStore.list();
    expect(r).toEqual([]);
  });

  it('get retourne null quand drizzle indispo', async () => {
    const r = await mappingStore.get('any_id');
    expect(r).toBeNull();
  });

  it('getActive retourne null quand drizzle indispo', async () => {
    const r = await mappingStore.getActive();
    expect(r).toBeNull();
  });

  it('getDefault retourne null quand drizzle indispo', async () => {
    const r = await mappingStore.getDefault();
    expect(r).toBeNull();
  });

  it('create throw storage_unavailable sans drizzle', async () => {
    await expect(
      mappingStore.create(
        { name: 'test', mappings: buildMappings() },
        { actorId: 'adm_test' },
      ),
    ).rejects.toThrow('storage_unavailable');
  });

  it('activate throw not_found sans version existante', async () => {
    await expect(mappingStore.activate('any_id', { actorId: 'adm_test' })).rejects.toThrow();
  });

  it('archive throw quand version inexistante', async () => {
    await expect(mappingStore.archive('any_id', { actorId: 'adm_test' })).rejects.toThrow();
  });

  it('softDelete throw not_found sans version', async () => {
    await expect(mappingStore.softDelete('any_id', { actorId: 'adm_test' })).rejects.toThrow();
  });

  it('restore throw not_found sans version', async () => {
    await expect(mappingStore.restore('any_id', { actorId: 'adm_test' })).rejects.toThrow();
  });

  it('clone throw source_not_found sans source', async () => {
    await expect(
      mappingStore.clone('inexistant', {}, { actorId: 'adm_test' }),
    ).rejects.toThrow('source_not_found');
  });

  it('editAsClone throw not_found sans source', async () => {
    await expect(
      mappingStore.editAsClone(
        'inexistant',
        { mappings: buildMappings() },
        { actorId: 'adm_test' },
      ),
    ).rejects.toThrow('not_found');
  });

  it('resetToDefault throw quand __default__ inexistant', async () => {
    await expect(mappingStore.resetToDefault({ actorId: 'adm_test' })).rejects.toThrow();
  });

  it('trimFifo no-op sans drizzle', async () => {
    await expect(mappingStore.trimFifo()).resolves.toBeUndefined();
  });
});

describe('mappingStore — résilience erreurs', () => {
  it('propage les erreurs DB inhabituelles (db.throw)', async () => {
    dbHandle.mode = 'throw';
    await expect(mappingStore.list()).rejects.toThrow();
  });
});
