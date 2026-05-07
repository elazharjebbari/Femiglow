/**
 * Tests d'intégration de la route visualization.
 *
 * Couvert :
 *   - GET /api/admin/tracking/gtm/visualization
 *   - 401 sans session
 *   - format=json renvoie un descriptor + stats
 *   - format=mermaid renvoie du texte Mermaid
 *   - configId override fonctionne (active / uuid)
 *   - env=dev → descriptor.folders=[]
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

import { GET as getViz } from '@/app/api/admin/tracking/gtm/visualization/route';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { emptyEnvConfig } from '@/lib/tracking/gtm/config-schema';

const ACTOR_ID = 'adm_test';

function url(params: Record<string, string>): string {
  const u = new URL('http://localhost/api/admin/tracking/gtm/visualization');
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
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });
});

afterEach(async () => {
  await gtmConfigStore._resetForTests({ actorId: ACTOR_ID });
});

describe('GET /api/admin/tracking/gtm/visualization', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await getViz(new Request(url({ env: 'production' })));
    expect(res.status).toBe(401);
  });

  it('format=json (par défaut) renvoie un descriptor avec folders', async () => {
    const res = await getViz(new Request(url({ env: 'production' })));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.env).toBe('production');
    expect(Array.isArray(body.descriptor.folders)).toBe(true);
    expect(body.descriptor.folders.length).toBeGreaterThan(0);
    expect(body.stats.tags).toBeGreaterThan(0);
  });

  it('format=mermaid renvoie du texte Mermaid', async () => {
    const res = await getViz(new Request(url({ env: 'production', format: 'mermaid' })));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('flowchart LR');
    expect(text).toContain('subgraph');
    expect(text).toContain('-->');
  });

  it('env=dev renvoie un descriptor vide', async () => {
    const res = await getViz(new Request(url({ env: 'dev' })));
    const body = await res.json();
    expect(body.descriptor.folders).toEqual([]);
    expect(body.stats.tags).toBe(0);
  });

  it('configId="active" applique la config active', async () => {
    const v = await gtmConfigStore.create(
      {
        name: 'v1',
        perEnv: {
          production: {
            ...emptyEnvConfig(),
            ga4MeasurementId: 'G-VIZACTIV',
            // Le builder n'émet de tags que pour les providers activés.
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
    const res = await getViz(
      new Request(url({ env: 'production', configId: 'active' })),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.descriptor.totalTags).toBeGreaterThan(0);
  });

  it('configId="active" avec enabledProviders=[] → 0 tags (provider explicitement désactivé)', async () => {
    await gtmConfigStore.create(
      {
        name: 'no-providers',
        perEnv: {
          production: { ...emptyEnvConfig(), ga4MeasurementId: 'G-NOPROV' },
          stage: emptyEnvConfig(),
          preview: emptyEnvConfig(),
          dev: emptyEnvConfig(),
        },
      },
      { actorId: ACTOR_ID },
    );
    const res = await getViz(new Request(url({ env: 'production', configId: 'active' })));
    const body = await res.json();
    expect(body.descriptor.totalTags).toBe(0);
  });

  it('Mermaid contient un classDef trigCE pour les Custom Events', async () => {
    const res = await getViz(new Request(url({ env: 'production', format: 'mermaid' })));
    const text = await res.text();
    expect(text).toContain('classDef trigCE');
  });

  it('refuse format inconnu (Zod 4xx)', async () => {
    const res = await getViz(new Request(url({ env: 'production', format: 'svg' })));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
