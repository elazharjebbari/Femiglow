/**
 * Tests d'intégration de la route container avec extension configId.
 *
 * Couvert :
 *   - GET /api/admin/tracking/gtm/container?env=...&configId=...
 *   - 401 sans session
 *   - format pretty / json / minified
 *   - download avec Content-Disposition + suffixe configId
 *   - configId = uuid valide → injecte la config perEnv
 *   - configId = active → utilise la version active
 *   - configId = uuid inconnu → fallback aux defaults (pas de 404)
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

import { GET as getContainer } from '@/app/api/admin/tracking/gtm/container/route';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { emptyEnvConfig } from '@/lib/tracking/gtm/config-schema';

const ACTOR_ID = 'adm_test';

function url(params: Record<string, string>): string {
  const u = new URL('http://localhost/api/admin/tracking/gtm/container');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
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

describe('GET /api/admin/tracking/gtm/container — auth & defaults', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await getContainer(new Request(url({ env: 'production' })));
    expect(res.status).toBe(401);
  });

  it('génère un container production sans config', async () => {
    const res = await getContainer(new Request(url({ env: 'production', format: 'pretty' })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.env).toBe('production');
    expect(body.configId).toBeNull();
    expect(body.pretty).toContain('"exportFormatVersion": 2');
    expect(body.stats.tags).toBeGreaterThan(0);
  });

  it('génère un container dev (0 tags)', async () => {
    const res = await getContainer(new Request(url({ env: 'dev', format: 'pretty' })));
    const body = await res.json();
    expect(body.stats.tags).toBe(0);
  });

  it('audit log appelé pour view', async () => {
    await getContainer(new Request(url({ env: 'production' })));
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export_view',
        resource: 'tracking_gtm',
      }),
    );
  });
});

describe('GET /api/admin/tracking/gtm/container — download', () => {
  it('retourne body brut + Content-Disposition + X-Container-SHA256', async () => {
    const res = await getContainer(
      new Request(url({ env: 'production', format: 'pretty', download: 'true' })),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="gtm-femiglow-production-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.headers.get('x-container-sha256')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('inclut le suffixe -cfgXXXXXXXX dans le filename si configId fourni', async () => {
    const v = await gtmConfigStore.create(
      {
        name: 'v1',
        perEnv: {
          production: { ...emptyEnvConfig(), ga4MeasurementId: 'G-CUSTOM00' },
          stage: emptyEnvConfig(),
          preview: emptyEnvConfig(),
          dev: emptyEnvConfig(),
        },
      },
      { actorId: ACTOR_ID },
    );
    const res = await getContainer(
      new Request(
        url({ env: 'production', format: 'pretty', download: 'true', configId: v.id }),
      ),
    );
    expect(res.status).toBe(200);
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toContain(`-cfg${v.id.slice(0, 8)}`);
  });

  it('retourne format minified si demandé', async () => {
    const res = await getContainer(
      new Request(url({ env: 'production', format: 'minified', download: 'true' })),
    );
    const text = await res.text();
    // Minified : pas de retour à la ligne ni d'indentation 2-spaces
    expect(text.includes('\n  "')).toBe(false);
    expect(text).toContain('"exportFormatVersion":2');
  });
});

describe('GET /api/admin/tracking/gtm/container — configId override', () => {
  it('utilise une config par UUID valide', async () => {
    const v = await gtmConfigStore.create(
      {
        name: 'v1',
        perEnv: {
          production: {
            ...emptyEnvConfig(),
            ga4MeasurementId: 'G-OVERRIDE',
            metaPixelId: '99999',
          },
          stage: emptyEnvConfig(),
          preview: emptyEnvConfig(),
          dev: emptyEnvConfig(),
        },
      },
      { actorId: ACTOR_ID },
    );
    const res = await getContainer(
      new Request(url({ env: 'production', format: 'pretty', configId: v.id })),
    );
    const body = await res.json();
    expect(body.configId).toBe(v.id);
    expect(body.pretty).toContain('G-OVERRIDE');
  });

  it('utilise la config "active" via le mot-clé', async () => {
    const v = await gtmConfigStore.create(
      {
        name: 'v1',
        perEnv: {
          production: { ...emptyEnvConfig(), ga4MeasurementId: 'G-ACTIVEXX' },
          stage: emptyEnvConfig(),
          preview: emptyEnvConfig(),
          dev: emptyEnvConfig(),
        },
      },
      { actorId: ACTOR_ID },
    );
    const res = await getContainer(
      new Request(url({ env: 'production', configId: 'active' })),
    );
    const body = await res.json();
    expect(body.configId).toBe(v.id);
    expect(body.pretty).toContain('G-ACTIVEXX');
  });

  it('configId="defaults" → ne charge pas de config (fallback defaults)', async () => {
    const res = await getContainer(
      new Request(url({ env: 'production', configId: 'defaults' })),
    );
    const body = await res.json();
    expect(body.configId).toBeNull();
    // Defaults builders : G-PROD0000 (cf. ENV_DEFAULTS)
    expect(body.pretty).toContain('G-PROD0000');
  });

  it('configId UUID inexistant → tolérant (fallback defaults, pas de 404)', async () => {
    const res = await getContainer(
      new Request(url({ env: 'production', configId: '00000000-0000-0000-0000-000000000000' })),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configId).toBeNull();
  });

  it('refuse les configId mal formés (pas UUID, pas active/defaults)', async () => {
    const res = await getContainer(
      new Request(url({ env: 'production', configId: 'random-string' })),
    );
    // Zod validation rejette → 400 ou 500 selon la branche d'erreur
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
