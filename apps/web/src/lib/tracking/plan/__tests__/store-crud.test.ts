/**
 * Tests atomiques pour le CRUD complet (delete + restore) sur le MemoryPlanStore.
 * Couvre les contrats du `PlanStore` qui doivent être respectés par toute
 * implémentation (memory + DB repository).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryPlanStore } from '../store-memory';
import type { TrackingPlanInput } from '../types';

const ACTOR = 'admin@femiglow.local';

const INPUT: TrackingPlanInput = {
  name: 'CRUD plan',
  providers: [
    { id: 'ga4', active: true },
    { id: 'meta', active: false },
  ],
  envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-XXX' } }],
  events: [{ key: 'page_view', providers: { ga4: true } }],
};

describe('PlanStore — delete', () => {
  let store: MemoryPlanStore;
  beforeEach(() => {
    store = new MemoryPlanStore();
  });

  it('supprime un draft et trace l\'action en audit', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.delete(created.id, ACTOR);
    expect(await store.findById(created.id)).toBeNull();

    const audit = await store.listAudit(created.id);
    const actions = audit.map((a) => a.action);
    expect(actions).toContain('create');
    expect(actions).toContain('delete');
    const deleteEntry = audit.find((a) => a.action === 'delete');
    expect(deleteEntry?.meta).toMatchObject({ name: INPUT.name, status: 'draft', version: 1 });
  });

  it('supprime un archived sans toucher aux autres plans', async () => {
    const a = await store.create({ ...INPUT, name: 'A' }, ACTOR);
    const b = await store.create({ ...INPUT, name: 'B' }, ACTOR);
    await store.archive(a.id, ACTOR);
    await store.delete(a.id, ACTOR);

    expect(await store.findById(a.id)).toBeNull();
    expect(await store.findById(b.id)).not.toBeNull();
  });

  it('refuse de supprimer un plan actif (doit être archivé d\'abord)', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.activate(created.id, ACTOR);
    await expect(store.delete(created.id, ACTOR)).rejects.toThrow('plan_active_cannot_delete');

    // Le plan reste présent malgré l'échec.
    expect(await store.findById(created.id)).not.toBeNull();
  });

  it('lève plan_not_found pour un id inexistant', async () => {
    await expect(store.delete('plan_unknown', ACTOR)).rejects.toThrow('plan_not_found');
  });
});

describe('PlanStore — restore', () => {
  let store: MemoryPlanStore;
  beforeEach(() => {
    store = new MemoryPlanStore();
  });

  it('passe un plan archived → draft et incrémente la version', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.archive(created.id, ACTOR);
    const restored = await store.restore(created.id, ACTOR);

    expect(restored.status).toBe('draft');
    expect(restored.version).toBe(created.version + 1);

    const audit = await store.listAudit(created.id);
    const actions = audit.map((a) => a.action);
    expect(actions).toContain('archive');
    expect(actions).toContain('restore');
    const restoreEntry = audit.find((a) => a.action === 'restore');
    expect(restoreEntry?.meta).toMatchObject({ previousVersion: 1 });
  });

  it('refuse de restaurer un draft (déjà non archivé)', async () => {
    const created = await store.create(INPUT, ACTOR);
    await expect(store.restore(created.id, ACTOR)).rejects.toThrow('plan_not_archived');
  });

  it('refuse de restaurer un plan actif', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.activate(created.id, ACTOR);
    await expect(store.restore(created.id, ACTOR)).rejects.toThrow('plan_not_archived');
  });

  it('lève plan_not_found pour un id inexistant', async () => {
    await expect(store.restore('plan_unknown', ACTOR)).rejects.toThrow('plan_not_found');
  });

  it('permet de re-restaurer après une nouvelle archive (cycle réversible)', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.archive(created.id, ACTOR);
    const first = await store.restore(created.id, ACTOR);
    await store.archive(first.id, ACTOR);
    const second = await store.restore(first.id, ACTOR);

    expect(second.status).toBe('draft');
    expect(second.version).toBe(first.version + 1);
  });
});

describe('PlanStore — update (édition structurée via PATCH)', () => {
  let store: MemoryPlanStore;
  beforeEach(() => {
    store = new MemoryPlanStore();
  });

  it('met à jour les champs partiels et incrémente version', async () => {
    const created = await store.create(INPUT, ACTOR);
    const patched = await store.update(
      created.id,
      { name: 'Renommé', events: [{ key: 'purchase', providers: { ga4: true } }] },
      created.version,
      ACTOR,
    );
    expect(patched.name).toBe('Renommé');
    expect(patched.events).toHaveLength(1);
    expect(patched.events[0]?.key).toBe('purchase');
    expect(patched.version).toBe(created.version + 1);
    // providers/envProfiles conservés si non patchés
    expect(patched.providers).toEqual(created.providers);
    expect(patched.envProfiles).toEqual(created.envProfiles);
  });

  it('lève VersionConflictError si If-Match obsolète', async () => {
    const created = await store.create(INPUT, ACTOR);
    await store.update(created.id, { name: 'V2' }, created.version, ACTOR);
    await expect(store.update(created.id, { name: 'V3' }, created.version, ACTOR)).rejects.toThrow(
      /version_conflict/,
    );
  });
});
