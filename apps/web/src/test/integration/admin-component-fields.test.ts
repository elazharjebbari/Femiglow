/**
 * Suite intégration — Components-CMS API.
 *
 * Couvre les 7 routes admin (+ cron) du domaine fields :
 *  - GET    /api/admin/components/[key]/fields
 *  - PATCH  /api/admin/components/[key]/fields/[fieldKey]
 *  - POST   /api/admin/components/[key]/fields/[fieldKey]/publish
 *  - POST   /api/admin/components/[key]/fields/[fieldKey]/schedule
 *  - POST   /api/admin/components/[key]/fields/[fieldKey]/cancel-schedule
 *  - POST   /api/admin/components/[key]/fields/[fieldKey]/restore
 *  - GET    /api/admin/components/[key]/fields/[fieldKey]/history
 *  - GET    /api/cron/promote-scheduled-fields
 *
 * Tests :
 *  - happy path (cycle complet : draft → publish → revalidateTag fired)
 *  - 401 sans session, 404 composant ou champ inconnu
 *  - 422 validation_failed (Zod field-level)
 *  - 409 version_conflict (If-Match désynchro)
 *  - 400 schedule_in_past
 *  - cron : Bearer secret + idempotence
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

vi.mock('@/lib/env', () => ({
  env: {
    CRON_SECRET: 'test-cron-secret',
  },
}));

import { GET as listFields } from '@/app/api/admin/components/[key]/fields/route';
import { PATCH as patchField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/route';
import { POST as publishField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/publish/route';
import { POST as scheduleField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/schedule/route';
import { POST as cancelScheduleField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/cancel-schedule/route';
import { POST as restoreField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/restore/route';
import { GET as historyField } from '@/app/api/admin/components/[key]/fields/[fieldKey]/history/route';
import { POST as cronPromote } from '@/app/api/cron/promote-scheduled-fields/route';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  ensureSeedPublishedBinding,
  getDraftBinding,
  getPublishedBinding,
  listHistory,
  upsertDraftBinding,
} from '@/lib/db/queries/component-fields';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: false,
  fields: [
    {
      key: 'title',
      label: 'Titre',
      type: 'text',
      required: true,
      defaultValue: 'Bienvenue',
      config: { maxLength: 80 },
    },
    {
      key: 'cta',
      label: 'CTA',
      type: 'cta',
      required: false,
      defaultValue: { label: 'Découvrir', href: '/rituel' },
    },
  ],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  sessionMock = {
    adminId: 'adm_1',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
  revalidateTagMock.mockClear();
});
afterAll(() => server.close());

beforeEach(async () => {
  resetMemoryStore();
  await upsertSiteComponentFromSeed(SEED);
});

function jsonRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('GET /api/admin/components/[key]/fields', () => {
  it('200 — renvoie tous les fields avec published/draft décodés', async () => {
    const cmpId = (await getDraftBinding('cmp_irrelevant', 'k', 'fr')) // touch import
      ? null
      : null;
    void cmpId;
    // Pré-seed : un published pour title.
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await ensureSeedPublishedBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'Hello',
    });

    const res = await listFields(jsonRequest('http://x/api/admin/components/home-hero/fields'), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      componentKey: string;
      locale: string;
      fields: Array<{ key: string; published: { value: unknown } | null; draft: unknown }>;
    };
    expect(body.componentKey).toBe('home-hero');
    expect(body.locale).toBe('fr');
    expect(body.fields).toHaveLength(2);
    const title = body.fields.find((f) => f.key === 'title')!;
    expect(title.published?.value).toBe('Hello');
    expect(title.draft).toBeNull();
  });

  it('401 sans session', async () => {
    sessionMock = null;
    const res = await listFields(
      jsonRequest('http://x/api/admin/components/home-hero/fields'),
      { params: { key: 'home-hero' } },
    );
    expect(res.status).toBe(401);
  });

  it('404 composant inconnu', async () => {
    const res = await listFields(jsonRequest('http://x/api/admin/components/zzz/fields'), {
      params: { key: 'zzz' },
    });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/components/[key]/fields/[fieldKey]', () => {
  it("200 — crée un draft (création initiale, pas d'If-Match requis)", async () => {
    const res = await patchField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title', {
        method: 'PATCH',
        body: JSON.stringify({ value: 'Nouveau titre', locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { binding: { status: string; value: unknown } };
    expect(body.binding.status).toBe('draft');
  });

  it('200 — met à jour le draft existant avec If-Match correct', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    const draft = await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V1',
      authorId: 'adm_1',
    });
    const res = await patchField(
      new Request('http://x/api/admin/components/home-hero/fields/title', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'if-match': draft.updatedAt.toISOString(),
        },
        body: JSON.stringify({ value: 'V2', locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
  });

  it('409 version_conflict — If-Match désynchronisé', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V1',
      authorId: 'adm_1',
    });
    const res = await patchField(
      new Request('http://x/api/admin/components/home-hero/fields/title', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'if-match': '1900-01-01T00:00:00.000Z',
        },
        body: JSON.stringify({ value: 'V2', locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('version_conflict');
  });

  it('422 validation_failed — text trop long (config.maxLength=80)', async () => {
    const res = await patchField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title', {
        method: 'PATCH',
        body: JSON.stringify({ value: 'x'.repeat(120), locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('validation_failed');
  });

  it('400 invalid_input — body sans value', async () => {
    const res = await patchField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title', {
        method: 'PATCH',
        body: JSON.stringify({ locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    // `value` est `unknown` (donc undefined accepté par Zod) — mais notre validateur
    // le refuse car la valeur encodée serait `undefined`. On tolère 400 ou 422.
    expect([400, 422]).toContain(res.status);
  });

  it('404 — fieldKey inconnu', async () => {
    const res = await patchField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/inexistant', {
        method: 'PATCH',
        body: JSON.stringify({ value: 'X', locale: 'fr' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'inexistant' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('POST .../publish', () => {
  it('200 — promeut draft → published, archive l\'ancien, revalidateTag', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await ensureSeedPublishedBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V1',
    });
    await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V2',
      authorId: 'adm_1',
    });
    const res = await publishField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/publish', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      binding: { status: string; version: number };
      previousPublishedId: string | null;
    };
    expect(body.binding.status).toBe('published');
    expect(body.binding.version).toBe(2);
    expect(body.previousPublishedId).not.toBeNull();
    // revalidateTag doit avoir été appelé pour les 3 tags du contrat B3.
    const calls = revalidateTagMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain('components');
    expect(calls).toContain('components:fields:home-hero');
    expect(calls).toContain('components:fields:home-hero:fr');
  });

  it('404 — pas de draft à publier', async () => {
    const res = await publishField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/publish', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('POST .../schedule + .../cancel-schedule', () => {
  it('200 — programme un draft, puis annule', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V2',
      authorId: 'adm_1',
    });
    const future = new Date(Date.now() + 5 * 60_000).toISOString();
    const res = await scheduleField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/schedule', {
        method: 'POST',
        body: JSON.stringify({ scheduledAt: future }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { binding: { status: string; scheduledAt: string } };
    expect(body.binding.status).toBe('scheduled');

    const cancelRes = await cancelScheduleField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/cancel-schedule', {
        method: 'POST',
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(cancelRes.status).toBe(200);
    const cancelBody = (await cancelRes.json()) as { binding: { status: string } };
    expect(cancelBody.binding.status).toBe('draft');
  });

  it('400 schedule_in_past', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V2',
      authorId: 'adm_1',
    });
    const past = new Date(Date.now() - 60_000).toISOString();
    const res = await scheduleField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/schedule', {
        method: 'POST',
        body: JSON.stringify({ scheduledAt: past }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('schedule_in_past');
  });
});

describe('POST .../restore', () => {
  it('200 — recrée un draft à partir d\'un snapshot history', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await ensureSeedPublishedBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V1',
    });
    const hist = await listHistory(cmp!.id, 'title', 'fr', 100);
    const seedEntry = hist.find((h) => h.action === 'publish')!;
    const res = await restoreField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/restore', {
        method: 'POST',
        body: JSON.stringify({ historyId: seedEntry.id }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      binding: { status: string; value: unknown };
      restoredFromVersion: number;
    };
    expect(body.binding.status).toBe('draft');
    expect(body.restoredFromVersion).toBe(seedEntry.version);
  });

  it('404 — historyId inconnu', async () => {
    const res = await restoreField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/restore', {
        method: 'POST',
        body: JSON.stringify({ historyId: 'cfh_unknown' }),
      }),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET .../history', () => {
  it('200 — renvoie les entrées en ordre desc avec valeurs décodées', async () => {
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    await ensureSeedPublishedBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V1',
    });
    await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V2',
      authorId: 'adm_1',
    });
    const res = await historyField(
      jsonRequest('http://x/api/admin/components/home-hero/fields/title/history?limit=5'),
      { params: { key: 'home-hero', fieldKey: 'title' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ action: string; value: unknown }>;
    };
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
    const actions = body.entries.map((e) => e.action);
    expect(actions).toContain('publish');
    expect(actions).toContain('create');
  });
});

describe('GET /api/cron/promote-scheduled-fields', () => {
  it('401 sans Bearer correct', async () => {
    const res = await cronPromote(
      jsonRequest('http://x/api/cron/promote-scheduled-fields', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('200 — promeut les scheduled échus, idempotent au 2ᵉ run', async () => {
    // Setup : un binding scheduled échu (on triche sur scheduledAt en
    // passant par schedule + manipulation du store : on programme à futur,
    // puis on remonte la date).
    const cmp = await import('@/lib/db/queries/site-components').then((m) =>
      m.getSiteComponentByKey('home-hero'),
    );
    const draft = await upsertDraftBinding({
      componentId: cmp!.id,
      fieldKey: 'title',
      value: 'V2',
      authorId: 'adm_1',
    });
    const future = new Date(Date.now() + 5 * 60_000);
    await import('@/lib/db/queries/component-fields').then((m) =>
      m.scheduleBinding({
        bindingId: draft.id,
        scheduledAt: future,
        actorId: 'adm_1',
      }),
    );
    // Force scheduledAt dans le passé (memory store).
    const { memoryStore } = await import('@/lib/db/client');
    const b = memoryStore().componentFieldBindings.get(draft.id)!;
    memoryStore().componentFieldBindings.set(draft.id, {
      ...b,
      scheduledAt: new Date(Date.now() - 60_000),
    });

    const res = await cronPromote(
      jsonRequest('http://x/api/cron/promote-scheduled-fields', {
        method: 'POST',
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { promoted: unknown[]; failed: unknown[] };
    expect(body.promoted).toHaveLength(1);
    expect(body.failed).toHaveLength(0);
    const pub = await getPublishedBinding(cmp!.id, 'title', 'fr');
    expect(pub?.value).toBe('V2');

    // 2e run : aucun scheduled échu à promouvoir.
    const res2 = await cronPromote(
      jsonRequest('http://x/api/cron/promote-scheduled-fields', {
        method: 'POST',
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    );
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { promoted: unknown[] };
    expect(body2.promoted).toHaveLength(0);
  });
});
