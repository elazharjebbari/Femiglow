/**
 * Tests d'intégration des routes API GTM configs (versionning).
 *
 * Routes testées :
 *   - GET    /api/admin/tracking/gtm/configs
 *   - POST   /api/admin/tracking/gtm/configs
 *   - GET    /api/admin/tracking/gtm/configs/[id]
 *   - DELETE /api/admin/tracking/gtm/configs/[id]
 *   - POST   /api/admin/tracking/gtm/configs/[id]/activate
 *
 * Cas couverts :
 *   - happy path (cycle complet : create → activate → list → delete)
 *   - 401 sans session
 *   - 400 payload invalide (Zod)
 *   - 404 config introuvable
 *   - 400 refus de delete sur version active
 *   - audit log créé pour create/activate/delete
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const { auditMock } = vi.hoisted(() => ({
  auditMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/tracking/server/audit', () => ({
  auditTrackingChange: auditMock,
}));

import { GET as listConfigs, POST as createConfig } from '@/app/api/admin/tracking/gtm/configs/route';
import {
  GET as getConfig,
  DELETE as deleteConfig,
} from '@/app/api/admin/tracking/gtm/configs/[id]/route';
import { POST as activateConfig } from '@/app/api/admin/tracking/gtm/configs/[id]/activate/route';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { emptyEnvConfig } from '@/lib/tracking/gtm/config-schema';

const ACTOR_ID = 'adm_test';

function makeReq(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

function fixturePerEnv() {
  return {
    production: { ...emptyEnvConfig(), ga4MeasurementId: 'G-PROD0000', metaPixelId: '111' },
    stage: { ...emptyEnvConfig(), ga4MeasurementId: 'G-STAGE000' },
    preview: { ...emptyEnvConfig(), ga4MeasurementId: 'G-PREV0000' },
    dev: { ...emptyEnvConfig() },
  };
}

beforeEach(async () => {
  sessionMock = {
    adminId: ACTOR_ID,
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  auditMock.mockClear();
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });
});

afterEach(async () => {
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });
});

describe('GET /api/admin/tracking/gtm/configs', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await listConfigs();
    expect(res.status).toBe(401);
  });

  it('retourne activeId null + versions vides quand rien n\'existe', async () => {
    const res = await listConfigs();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeId).toBeNull();
    expect(body.versions).toEqual([]);
  });

  it('retourne les versions triées par date desc', async () => {
    await gtmConfigStore.create({ name: 'v1', perEnv: fixturePerEnv() }, { actorId: ACTOR_ID });
    await new Promise((r) => setTimeout(r, 5));
    await gtmConfigStore.create({ name: 'v2', perEnv: fixturePerEnv() }, { actorId: ACTOR_ID });
    const res = await listConfigs();
    const body = await res.json();
    expect(body.versions.map((v: { name: string }) => v.name)).toEqual(['v2', 'v1']);
  });
});

describe('POST /api/admin/tracking/gtm/configs', () => {
  it('crée une config valide', async () => {
    const res = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v1', notes: null, perEnv: fixturePerEnv() }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('v1');
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.createdBy).toBe(ACTOR_ID);
  });

  it('audit log appelé après création', async () => {
    await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v1', perEnv: fixturePerEnv() }),
      }),
    );
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'tracking_gtm',
        actorId: ACTOR_ID,
      }),
    );
  });

  it('refuse 401 sans session', async () => {
    sessionMock = null;
    const res = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v1', perEnv: fixturePerEnv() }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('refuse les payloads invalides (Zod 400)', async () => {
    const res = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', perEnv: fixturePerEnv() }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('refuse les Pixel IDs Meta non-numériques', async () => {
    const bad = fixturePerEnv();
    bad.production.metaPixelId = 'not-a-number';
    const res = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v1', perEnv: bad }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /api/admin/tracking/gtm/configs/[id]', () => {
  it('retourne la version complète avec perEnv', async () => {
    const v = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    const res = await getConfig(makeReq(`http://x/${v.id}`), { params: { id: v.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(v.id);
    expect(body.perEnv.production.ga4MeasurementId).toBe('G-PROD0000');
  });

  it('retourne 404 si config introuvable', async () => {
    const res = await getConfig(makeReq('http://x/...'), {
      params: { id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/tracking/gtm/configs/[id]/activate', () => {
  it('active la version cible', async () => {
    const v1 = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    const v2 = await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    const res = await activateConfig(makeReq('http://x/'), { params: { id: v2.id } });
    expect(res.status).toBe(200);
    const list = await gtmConfigStore.list();
    expect(list.activeId).toBe(v2.id);
    expect(list.activeId).not.toBe(v1.id);
  });

  it('audit log enable appelé', async () => {
    const v = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    auditMock.mockClear();
    await activateConfig(makeReq('http://x/'), { params: { id: v.id } });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'enable', resource: 'tracking_gtm' }),
    );
  });

  it('retourne 404 pour une version inexistante', async () => {
    const res = await activateConfig(makeReq('http://x/'), {
      params: { id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/tracking/gtm/configs/[id]', () => {
  it('supprime une version archivée', async () => {
    await gtmConfigStore.create({ name: 'v1', perEnv: fixturePerEnv() }, { actorId: ACTOR_ID });
    const v2 = await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    const res = await deleteConfig(makeReq('http://x/'), { params: { id: v2.id } });
    expect(res.status).toBe(200);
    const list = await gtmConfigStore.list();
    expect(list.versions.find((v) => v.id === v2.id)).toBeUndefined();
  });

  it('refuse de supprimer la version active', async () => {
    const v = await gtmConfigStore.create(
      { name: 'v1', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    const res = await deleteConfig(makeReq('http://x/'), { params: { id: v.id } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('audit log delete appelé', async () => {
    await gtmConfigStore.create({ name: 'v1', perEnv: fixturePerEnv() }, { actorId: ACTOR_ID });
    const v2 = await gtmConfigStore.create(
      { name: 'v2', perEnv: fixturePerEnv() },
      { actorId: ACTOR_ID },
    );
    auditMock.mockClear();
    await deleteConfig(makeReq('http://x/'), { params: { id: v2.id } });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', resource: 'tracking_gtm' }),
    );
  });
});

describe('Cycle complet — create + activate + delete', () => {
  it('cycle bout-en-bout', async () => {
    // 1. Créer v1 (devient active automatiquement)
    const r1 = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v1', perEnv: fixturePerEnv() }),
      }),
    );
    const v1 = await r1.json();

    // 2. Créer v2
    const r2 = await createConfig(
      makeReq('http://x/api/admin/tracking/gtm/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'v2', perEnv: fixturePerEnv() }),
      }),
    );
    const v2 = await r2.json();

    // 3. Activer v2
    await activateConfig(makeReq('http://x/'), { params: { id: v2.id } });

    // 4. Lister — doit retourner activeId=v2 et 2 versions
    const list = await listConfigs();
    const listBody = await list.json();
    expect(listBody.activeId).toBe(v2.id);
    expect(listBody.versions).toHaveLength(2);

    // 5. Supprimer v1 (archivée maintenant) — doit fonctionner
    const del = await deleteConfig(makeReq('http://x/'), { params: { id: v1.id } });
    expect(del.status).toBe(200);

    const list2 = await listConfigs();
    const listBody2 = await list2.json();
    expect(listBody2.versions).toHaveLength(1);
  });
});
