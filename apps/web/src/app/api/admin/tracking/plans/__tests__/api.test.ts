/**
 * Tests d'intégration des endpoints /api/admin/tracking/plans/*.
 *
 * Pile testée : route handlers → TrackingPlanService → MemoryPlanStore.
 * Seul `getAdminSession` est mocké pour simuler l'authentification admin.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { getMemoryStore } from '@/lib/tracking/plan';
import type { TrackingPlanInput } from '@/lib/tracking/plan';

import { GET as listPlans, POST as createPlan } from '../route';
import { GET as getPlan, PATCH as patchPlan, DELETE as deletePlan } from '../[id]/route';
import { POST as activatePlan } from '../[id]/activate/route';
import { POST as archivePlan } from '../[id]/archive/route';
import { POST as restorePlan } from '../[id]/restore/route';
import { POST as seedDefaultPlan } from '../seed-default/route';
import { GET as validatePlanRoute } from '../[id]/validate/route';
import { GET as exportPlanRoute } from '../[id]/export/route';
import { GET as auditRoute } from '../audit/route';
import { GET as defaultsRoute } from '../defaults/route';
import { GET as diffRoute } from '../diff/route';

const adminSession = {
  adminId: 'adm_1',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: 0,
} as never;

function url(path: string): string {
  return `https://femiglow.test${path}`;
}

function buildInput(overrides: Partial<TrackingPlanInput> = {}): TrackingPlanInput {
  return {
    name: 'Plan principal',
    providers: [
      { id: 'ga4', active: true },
      { id: 'googleAds', active: false },
      { id: 'meta', active: false },
      { id: 'tiktok', active: false },
      { id: 'gtm', active: false },
    ],
    envProfiles: [
      {
        env: 'production',
        config: {
          ga4MeasurementId: 'G-5VHP17SDZM',
        },
      },
    ],
    events: [{ key: 'page_view', providers: { ga4: true } }],
    ...overrides,
  };
}

beforeEach(async () => {
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
  await getMemoryStore().reset();
});

describe('GET /api/admin/tracking/plans', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await listPlans(new Request(url('/api/admin/tracking/plans')));
    expect(res.status).toBe(401);
  });

  it('200 liste vide initialement', async () => {
    const res = await listPlans(new Request(url('/api/admin/tracking/plans')));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[]; total: number };
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
  });

  it('200 filtre par status', async () => {
    await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'Plan A' })),
      }),
    );
    await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'Plan B' })),
      }),
    );

    const res = await listPlans(new Request(url('/api/admin/tracking/plans?status=draft')));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });
});

describe('POST /api/admin/tracking/plans', () => {
  it('201 crée un plan', async () => {
    const res = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; status: string; version: number };
    expect(body.id).toMatch(/^plan_/);
    expect(body.status).toBe('draft');
    expect(body.version).toBe(1);
  });

  it('422 si payload invalide', async () => {
    const res = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('400 si JSON invalide', async () => {
    const res = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: 'not-json',
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/tracking/plans/[id]', () => {
  it('404 si plan absent', async () => {
    const res = await getPlan(new Request(url('/api/admin/tracking/plans/missing')), {
      params: { id: 'missing' },
    });
    expect(res.status).toBe(404);
  });

  it('200 retourne le plan', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await getPlan(new Request(url(`/api/admin/tracking/plans/${plan.id}`)), {
      params: { id: plan.id },
    });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/tracking/plans/[id]', () => {
  it('400 si header If-Match absent', async () => {
    const res = await patchPlan(
      new Request(url('/api/admin/tracking/plans/x'), {
        method: 'PATCH',
        body: JSON.stringify({ name: 'X' }),
      }),
      { params: { id: 'x' } },
    );
    expect(res.status).toBe(400);
  });

  it('200 met à jour le plan', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string; version: number };
    const res = await patchPlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}`), {
        method: 'PATCH',
        headers: { 'if-match': String(plan.version) },
        body: JSON.stringify({ name: 'Renommé' }),
      }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { name: string; version: number };
    expect(updated.name).toBe('Renommé');
    expect(updated.version).toBe(plan.version + 1);
  });

  it('409 si version obsolète', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await patchPlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}`), {
        method: 'PATCH',
        headers: { 'if-match': '999' },
        body: JSON.stringify({ name: 'X' }),
      }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/tracking/plans/[id]/activate', () => {
  it('200 active un plan valide', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/activate`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const activated = (await res.json()) as { status: string };
    expect(activated.status).toBe('active');
  });

  it('422 si plan invalide (aucun provider actif)', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(
          buildInput({
            providers: [{ id: 'ga4', active: false }],
          }),
        ),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/activate`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(422);
  });

  it('archive l\'ancien actif lors de la nouvelle activation', async () => {
    const a = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'A' })),
      }),
    );
    const planA = (await a.json()) as { id: string };
    const b = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'B' })),
      }),
    );
    const planB = (await b.json()) as { id: string };

    await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${planA.id}/activate`), { method: 'POST' }),
      { params: { id: planA.id } },
    );
    await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${planB.id}/activate`), { method: 'POST' }),
      { params: { id: planB.id } },
    );

    const reGetA = await getPlan(new Request(url(`/api/admin/tracking/plans/${planA.id}`)), {
      params: { id: planA.id },
    });
    const stateA = (await reGetA.json()) as { status: string };
    expect(stateA.status).toBe('archived');
  });
});

describe('POST /api/admin/tracking/plans/[id]/archive', () => {
  it('200 archive un plan draft', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await archivePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/archive`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const archived = (await res.json()) as { status: string };
    expect(archived.status).toBe('archived');
  });
});

describe('GET /api/admin/tracking/plans/[id]/validate', () => {
  it('200 retourne ValidationResult', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await validatePlanRoute(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/validate`)),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('GET /api/admin/tracking/plans/[id]/export', () => {
  it('200 export GTM déterministe', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await exportPlanRoute(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/export?env=production`)),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { bundleId: string; json: unknown };
    expect(body.bundleId).toMatch(/^[a-f0-9]{64}$/);
    expect(body.json).toBeDefined();
  });

  it('400 si env inconnu', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await exportPlanRoute(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/export?env=mars`)),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/tracking/plans/audit', () => {
  it('200 retourne le journal vide', async () => {
    const res = await auditRoute(new Request(url('/api/admin/tracking/plans/audit')));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(0);
  });

  it('200 audit après création + activation', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/activate`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    const res = await auditRoute(
      new Request(url(`/api/admin/tracking/plans/audit?planId=${plan.id}`)),
    );
    const body = (await res.json()) as {
      data: Array<{ action: string }>;
      total: number;
    };
    expect(body.total).toBeGreaterThanOrEqual(2);
    const actions = body.data.map((a) => a.action);
    expect(actions).toContain('create');
    expect(actions).toContain('activate');
  });
});

describe('GET /api/admin/tracking/plans/defaults', () => {
  it('200 retourne les defaults seedés', async () => {
    const res = await defaultsRoute();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, string> };
    expect(body.data.ga4MeasurementId).toBe('G-5VHP17SDZM');
    expect(body.data.gtmContainerId).toBe('GTM-M8K7V88D');
  });
});

describe('GET /api/admin/tracking/plans/diff', () => {
  it('400 si paramètres manquants', async () => {
    const res = await diffRoute(new Request(url('/api/admin/tracking/plans/diff')));
    expect(res.status).toBe(400);
  });

  it('200 retourne le changeset', async () => {
    const a = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'A' })),
      }),
    );
    const planA = (await a.json()) as { id: string };
    const b = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput({ name: 'B' })),
      }),
    );
    const planB = (await b.json()) as { id: string };

    const res = await diffRoute(
      new Request(url(`/api/admin/tracking/plans/diff?a=${planA.id}&b=${planB.id}`)),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { changes: Array<{ path: string }> };
    expect(Array.isArray(body.changes)).toBe(true);
  });

  it('404 si un plan absent', async () => {
    const res = await diffRoute(new Request(url('/api/admin/tracking/plans/diff?a=x&b=y')));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/tracking/plans/[id]', () => {
  it('204 supprime un draft', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await deletePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}`), { method: 'DELETE' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(204);

    const verify = await getPlan(new Request(url(`/api/admin/tracking/plans/${plan.id}`)), {
      params: { id: plan.id },
    });
    expect(verify.status).toBe(404);
  });

  it('204 supprime un archived', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    await archivePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/archive`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    const res = await deletePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}`), { method: 'DELETE' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(204);
  });

  it('400 refuse la suppression d\'un plan actif', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    await activatePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/activate`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    const res = await deletePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}`), { method: 'DELETE' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(400);
  });

  it('404 si plan introuvable', async () => {
    const res = await deletePlan(
      new Request(url('/api/admin/tracking/plans/plan_unknown'), { method: 'DELETE' }),
      { params: { id: 'plan_unknown' } },
    );
    expect(res.status).toBe(404);
  });

  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await deletePlan(
      new Request(url('/api/admin/tracking/plans/x'), { method: 'DELETE' }),
      { params: { id: 'x' } },
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/tracking/plans/[id]/restore', () => {
  it('200 restaure un archived → draft avec version + 1', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string; version: number };
    await archivePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/archive`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    const res = await restorePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/restore`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(200);
    const restored = (await res.json()) as { status: string; version: number };
    expect(restored.status).toBe('draft');
    expect(restored.version).toBe(plan.version + 1);
  });

  it('400 si plan non archivé', async () => {
    const created = await createPlan(
      new Request(url('/api/admin/tracking/plans'), {
        method: 'POST',
        body: JSON.stringify(buildInput()),
      }),
    );
    const plan = (await created.json()) as { id: string };
    const res = await restorePlan(
      new Request(url(`/api/admin/tracking/plans/${plan.id}/restore`), { method: 'POST' }),
      { params: { id: plan.id } },
    );
    expect(res.status).toBe(400);
  });

  it('404 si plan introuvable', async () => {
    const res = await restorePlan(
      new Request(url('/api/admin/tracking/plans/plan_unknown/restore'), { method: 'POST' }),
      { params: { id: 'plan_unknown' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/tracking/plans/seed-default', () => {
  it('401 sans session admin', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null as never);
    const res = await seedDefaultPlan(
      new Request(url('/api/admin/tracking/plans/seed-default'), { method: 'POST' }),
    );
    expect(res.status).toBe(401);
  });

  it('201 crée un plan brouillon à partir du catalogue applicatif', async () => {
    const res = await seedDefaultPlan(
      new Request(url('/api/admin/tracking/plans/seed-default'), {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(201);
    const plan = (await res.json()) as {
      id: string;
      status: string;
      version: number;
      name: string;
      providers: Array<{ id: string; active: boolean }>;
      events: Array<{ key: string }>;
    };
    expect(plan.status).toBe('draft');
    expect(plan.version).toBe(1);
    expect(plan.name).toBe('Plan canonique FemiGlow');
    expect(plan.events.length).toBeGreaterThan(10);

    // Conversion-clés présentes.
    const keys = plan.events.map((e) => e.key);
    expect(keys).toContain('purchase');
    expect(keys).toContain('generate_lead');
    expect(keys).toContain('sign_up');

    // Providers principaux activés.
    expect(plan.providers.find((p) => p.id === 'ga4')?.active).toBe(true);
    expect(plan.providers.find((p) => p.id === 'gtm')?.active).toBe(false);
  });

  it('respecte le nom personnalisé du body', async () => {
    const res = await seedDefaultPlan(
      new Request(url('/api/admin/tracking/plans/seed-default'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Plan reset staging' }),
      }),
    );
    expect(res.status).toBe(201);
    const plan = (await res.json()) as { name: string };
    expect(plan.name).toBe('Plan reset staging');
  });

  it('400 si JSON invalide', async () => {
    const res = await seedDefaultPlan(
      new Request(url('/api/admin/tracking/plans/seed-default'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('crée un audit `create` avec l\'admin comme auteur', async () => {
    const res = await seedDefaultPlan(
      new Request(url('/api/admin/tracking/plans/seed-default'), { method: 'POST' }),
    );
    const plan = (await res.json()) as { id: string };
    const auditRes = await auditRoute(
      new Request(url(`/api/admin/tracking/plans/audit?planId=${plan.id}`)),
    );
    const audit = (await auditRes.json()) as { data: Array<{ action: string; actorEmail: string }> };
    expect(audit.data[0]?.action).toBe('create');
    expect(audit.data[0]?.actorEmail).toBe('admin@femiglow.test');
  });
});
