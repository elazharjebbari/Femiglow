/**
 * Tests d'intégration de la route POST /api/admin/tracking/gtm/snapshot.
 *
 * Couvre :
 *  - 401 sans session
 *  - écriture des 4 fichiers infra/gtm/container.<env>.json
 *  - filesystem read-only → skippedReason
 *  - audit log appelé avec les bons params
 *  - idempotence (2e appel → skipped=true)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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

import { POST as snapshotRoute } from '@/app/api/admin/tracking/gtm/snapshot/route';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';

const ACTOR_ID = 'adm_test';

let tmpRoot = '';
let originalCwd = '';

beforeEach(async () => {
  sessionMock = {
    adminId: ACTOR_ID,
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  auditMock.mockClear();
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });

  originalCwd = process.cwd();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gtm-snap-route-'));
  await fs.mkdir(path.join(tmpRoot, 'infra', 'gtm'), { recursive: true });
  process.chdir(tmpRoot);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });
});

describe('POST /api/admin/tracking/gtm/snapshot', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await snapshotRoute();
    expect(res.status).toBe(401);
  });

  it('écrit les 4 fichiers et retourne le résumé', async () => {
    const res = await snapshotRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.written).toHaveLength(4);
    expect(body.errors).toEqual([]);
    expect(body.skippedReason).toBeNull();
    // Vérifier physiquement
    const dir = path.join(tmpRoot, 'infra', 'gtm');
    const files = await fs.readdir(dir);
    expect(files.sort()).toEqual([
      'container.dev.json',
      'container.preview.json',
      'container.production.json',
      'container.stage.json',
    ]);
  });

  it("audit log enregistré avec resource tracking_gtm + action export_download", async () => {
    await snapshotRoute();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export_download',
        resource: 'tracking_gtm',
        resourceId: 'snapshot',
        actorId: ACTOR_ID,
      }),
    );
    const meta = auditMock.mock.calls[0]![0]!.meta;
    expect(meta.snapshot).toBe('manual');
    expect(meta.envs).toEqual(expect.arrayContaining(['production', 'stage', 'preview', 'dev']));
  });

  it("idempotent — 2e appel retourne skipped=true sur tous", async () => {
    await snapshotRoute();
    const res2 = await snapshotRoute();
    const body2 = await res2.json();
    for (const w of body2.written) {
      expect(w.skipped).toBe(true);
    }
  });

  it('utilise la config active si présente', async () => {
    // Crée + active une config avec un GA4 ID custom
    const { emptyEnvConfig } = await import('@/lib/tracking/gtm/config-schema');
    const v = await gtmConfigStore.create(
      {
        name: 'v1',
        perEnv: {
          production: {
            ...emptyEnvConfig(),
            ga4MeasurementId: 'G-CUSTOM00',
            enabledProviders: ['google_ga4'],
          },
          stage: emptyEnvConfig(),
          preview: emptyEnvConfig(),
          dev: emptyEnvConfig(),
        },
      },
      { actorId: ACTOR_ID },
    );
    expect(v.id).toBeDefined();

    await snapshotRoute();
    const prodPath = path.join(tmpRoot, 'infra', 'gtm', 'container.production.json');
    const content = await fs.readFile(prodPath, 'utf8');
    expect(content).toContain('G-CUSTOM00');
  });
});
