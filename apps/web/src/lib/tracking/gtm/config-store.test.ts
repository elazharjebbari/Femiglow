/**
 * Tests du store de configurations GTM.
 *
 * On utilise le memoryStore de la lib `tracking/settings` (en absence
 * de DRIZZLE_DATABASE_URL en test). Reset entre les tests via le
 * test seam `_resetForTests`.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { gtmConfigStore } from './config-store';
import { emptyEnvConfig } from './config-schema';

const ACTOR = 'admin_test_user';

function fixturePerEnv() {
  return {
    production: { ...emptyEnvConfig(), ga4MeasurementId: 'G-PROD0000', metaPixelId: '111' },
    stage: { ...emptyEnvConfig(), ga4MeasurementId: 'G-STAGE000' },
    preview: { ...emptyEnvConfig(), ga4MeasurementId: 'G-PREV0000' },
    dev: { ...emptyEnvConfig() },
  };
}

beforeEach(async () => {
  await gtmConfigStore._resetForTests({ actorId: ACTOR });
});

afterEach(async () => {
  await gtmConfigStore._resetForTests({ actorId: ACTOR });
});

describe('gtmConfigStore.list', () => {
  it("retourne un état vide initial (activeId null, versions vides)", async () => {
    const r = await gtmConfigStore.list();
    expect(r.activeId).toBeNull();
    expect(r.versions).toEqual([]);
  });
});

describe('gtmConfigStore.create', () => {
  it('crée une version avec id UUID + auteur + timestamp', async () => {
    const v = await gtmConfigStore.create(
      { name: 'v1', notes: 'initial', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    expect(v.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(v.name).toBe('v1');
    expect(v.notes).toBe('initial');
    expect(v.createdBy).toBe(ACTOR);
    expect(v.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('active automatiquement la première version créée', async () => {
    const v = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    const active = await gtmConfigStore.getActive();
    expect(active?.id).toBe(v.id);
  });

  it('ne change pas l\'active sur les créations suivantes', async () => {
    const v1 = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    const active = await gtmConfigStore.getActive();
    expect(active?.id).toBe(v1.id);
  });

  it('rejette les noms vides', async () => {
    await expect(
      gtmConfigStore.create(
        { name: '', perEnv: fixturePerEnv() },
        { actorId: ACTOR },
      ),
    ).rejects.toThrow();
  });

  it('rejette les Pixel IDs invalides (Meta non numérique)', async () => {
    const bad = fixturePerEnv();
    bad.production.metaPixelId = 'not-a-number';
    await expect(
      gtmConfigStore.create({ name: 'v1', perEnv: bad }, { actorId: ACTOR }),
    ).rejects.toThrow();
  });

  it('accepte les valeurs vides (provider non configuré)', async () => {
    const empty = {
      production: emptyEnvConfig(),
      stage: emptyEnvConfig(),
      preview: emptyEnvConfig(),
      dev: emptyEnvConfig(),
    };
    const v = await gtmConfigStore.create(
      { name: 'v1', perEnv: empty },
      { actorId: ACTOR },
    );
    expect(v.perEnv.production.ga4MeasurementId).toBe('');
  });
});

describe('gtmConfigStore.activate', () => {
  it('change l\'active vers la version cible', async () => {
    const v1 = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    const v2 = await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await gtmConfigStore.activate(v2.id, { actorId: ACTOR });
    const active = await gtmConfigStore.getActive();
    expect(active?.id).toBe(v2.id);
    expect(active?.id).not.toBe(v1.id);
  });

  it('lève si la version cible n\'existe pas', async () => {
    await expect(
      gtmConfigStore.activate('00000000-0000-0000-0000-000000000000', { actorId: ACTOR }),
    ).rejects.toThrow('config_version_not_found');
  });
});

describe('gtmConfigStore.remove', () => {
  it('supprime une version archivée', async () => {
    await gtmConfigStore.create({ name: 'v1', perEnv: fixturePerEnv() }, { actorId: ACTOR });
    const v2 = await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await gtmConfigStore.remove(v2.id, { actorId: ACTOR });
    const list = await gtmConfigStore.list();
    expect(list.versions.find((v) => v.id === v2.id)).toBeUndefined();
  });

  it('refuse de supprimer la version active', async () => {
    const v1 = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await expect(
      gtmConfigStore.remove(v1.id, { actorId: ACTOR }),
    ).rejects.toThrow('cannot_remove_active_config');
  });
});

describe('gtmConfigStore — historique', () => {
  it('liste les versions par date desc', async () => {
    await gtmConfigStore.create(
      { name: 'oldest', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await new Promise((r) => setTimeout(r, 5));
    await gtmConfigStore.create(
      { name: 'middle', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    await new Promise((r) => setTimeout(r, 5));
    await gtmConfigStore.create(
      { name: 'newest', perEnv: fixturePerEnv() },
      { actorId: ACTOR },
    );
    const list = await gtmConfigStore.list();
    expect(list.versions.map((v) => v.name)).toEqual(['newest', 'middle', 'oldest']);
  });
});
