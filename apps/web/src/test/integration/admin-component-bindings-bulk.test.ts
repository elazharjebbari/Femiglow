/**
 * Suite intégration MSW — POST /api/admin/components/bindings/bulk + PATCH
 * étendu avec display modes.
 *
 * Couvre :
 *  - bulk activate/deactivate sur plusieurs IDs,
 *  - bulk delete,
 *  - bulk update (objectFit/objectPosition),
 *  - 401 sans session, 400 payload invalide,
 *  - PATCH d'un binding seul avec patch d'affichage (objectFit + focalX/Y).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { server } from '@/test/msw/server';

let sessionMock: { adminId: string; email: string; issuedAt: number; expiresAt: number } | null = {
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

import { POST as bulkPOST } from '@/app/api/admin/components/bindings/bulk/route';
import { PATCH } from '@/app/api/admin/components/[key]/bindings/[bindingId]/route';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia } from '@/lib/db/queries/media';
import {
  upsertBinding,
  listBindingsByComponent,
} from '@/lib/db/queries/component-bindings';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [
    { key: 'primary', label: 'Visuel', required: true, acceptKinds: ['image'] },
    { key: 'secondary', label: 'Visuel 2', required: false, acceptKinds: ['image'] },
    { key: 'tertiary', label: 'Visuel 3', required: false, acceptKinds: ['image'] },
  ],
  defaultSvgFallback: '/svg/hero.svg',
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
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
});
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

async function setupThreeBindings() {
  const cmp = await upsertSiteComponentFromSeed(SEED);
  const ids: string[] = [];
  for (const slot of ['primary', 'secondary', 'tertiary']) {
    const m = await createMedia({
      kind: 'image',
      source: 'upload',
      slug: `bulk-${slot}`,
      alt: slot,
      caption: null,
      credit: null,
      originalFilename: `${slot}.png`,
      originalMime: 'image/png',
      originalSizeBytes: 1024,
      originalUrl: null,
      qualityProfile: 'hero',
      loadingStrategy: 'eager',
      isHero: true,
      createdBy: null,
    });
    const b = await upsertBinding({
      componentId: cmp.id,
      slot,
      mediaId: m.id,
      isActive: false,
      loadingStrategy: 'eager',
      fetchPriority: 'high',
      priority: true,
      placeholderStrategy: 'svg',
      customAlt: null,
      displayOrder: 0,
      notes: null,
      createdBy: null,
    });
    ids.push(b.id);
  }
  return { cmp, ids };
}

function bulkReq(body: unknown) {
  return new Request('http://localhost/api/admin/components/bindings/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.1' },
    body: JSON.stringify(body),
  });
}

function patchReq(body: unknown) {
  return new Request('http://localhost/api/admin/components/home-hero/bindings/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/components/bindings/bulk', () => {
  it('bulk activate sur 3 bindings', async () => {
    const { cmp, ids } = await setupThreeBindings();
    const res = await bulkPOST(bulkReq({ action: 'activate', ids }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, count: 3 });
    const all = await listBindingsByComponent(cmp.id);
    expect(all.every((b) => b.isActive)).toBe(true);
  });

  it('bulk deactivate après activation', async () => {
    const { cmp, ids } = await setupThreeBindings();
    await bulkPOST(bulkReq({ action: 'activate', ids }));
    const res = await bulkPOST(bulkReq({ action: 'deactivate', ids }));
    expect(res.status).toBe(200);
    const all = await listBindingsByComponent(cmp.id);
    expect(all.every((b) => !b.isActive)).toBe(true);
  });

  it('bulk delete supprime tous les bindings sélectionnés', async () => {
    const { cmp, ids } = await setupThreeBindings();
    const res = await bulkPOST(bulkReq({ action: 'delete', ids }));
    expect(res.status).toBe(200);
    const all = await listBindingsByComponent(cmp.id);
    expect(all).toHaveLength(0);
  });

  it('bulk update (display modes)', async () => {
    const { cmp, ids } = await setupThreeBindings();
    const res = await bulkPOST(
      bulkReq({
        action: 'update',
        ids,
        patch: { objectFit: 'contain', objectPosition: 'top' },
      }),
    );
    expect(res.status).toBe(200);
    const all = await listBindingsByComponent(cmp.id);
    for (const b of all) {
      expect(b.objectFit).toBe('contain');
      expect(b.objectPosition).toBe('top');
    }
  });

  it('400 sur action=update sans patch', async () => {
    const { ids } = await setupThreeBindings();
    const res = await bulkPOST(bulkReq({ action: 'update', ids }));
    expect(res.status).toBe(400);
  });

  it('400 sur ids vide', async () => {
    const res = await bulkPOST(bulkReq({ action: 'activate', ids: [] }));
    expect(res.status).toBe(400);
  });

  it('400 sur action invalide', async () => {
    const { ids } = await setupThreeBindings();
    const res = await bulkPOST(bulkReq({ action: 'launch-rocket', ids }));
    expect(res.status).toBe(400);
  });

  it('401 sans session', async () => {
    const { ids } = await setupThreeBindings();
    sessionMock = null;
    const res = await bulkPOST(bulkReq({ action: 'activate', ids }));
    expect(res.status).toBe(401);
  });
});

describe('PATCH binding (display modes étendu)', () => {
  it('PATCH avec objectFit + focalX/Y persiste les valeurs', async () => {
    const { cmp, ids } = await setupThreeBindings();
    const res = await PATCH(
      patchReq({ objectFit: 'contain', focalX: 25, focalY: 75 }),
      { params: { key: 'home-hero', bindingId: ids[0]! } },
    );
    expect(res.status).toBe(200);
    const all = await listBindingsByComponent(cmp.id);
    const updated = all.find((b) => b.id === ids[0])!;
    expect(updated.objectFit).toBe('contain');
    expect(updated.focalX).toBe(25);
    expect(updated.focalY).toBe(75);
  });

  it('PATCH peut combiner isActive + objectFit', async () => {
    const { cmp, ids } = await setupThreeBindings();
    const res = await PATCH(
      patchReq({ isActive: true, objectFit: 'cover' }),
      { params: { key: 'home-hero', bindingId: ids[0]! } },
    );
    expect(res.status).toBe(200);
    const updated = (await listBindingsByComponent(cmp.id)).find((b) => b.id === ids[0])!;
    expect(updated.isActive).toBe(true);
    expect(updated.objectFit).toBe('cover');
  });

  it('PATCH avec body vide → 400', async () => {
    const { ids } = await setupThreeBindings();
    const res = await PATCH(patchReq({}), {
      params: { key: 'home-hero', bindingId: ids[0]! },
    });
    expect(res.status).toBe(400);
  });

  it('PATCH avec focalX hors bornes → 400', async () => {
    const { ids } = await setupThreeBindings();
    const res = await PATCH(patchReq({ focalX: 250 }), {
      params: { key: 'home-hero', bindingId: ids[0]! },
    });
    expect(res.status).toBe(400);
  });
});
