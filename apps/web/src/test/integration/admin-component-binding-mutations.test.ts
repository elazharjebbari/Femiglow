/**
 * Suite intégration MSW — PATCH/DELETE
 * /api/admin/components/[key]/bindings/[bindingId].
 *
 * Couvre :
 *  - PATCH 200  → toggle isActive
 *  - PATCH 401  → sans session
 *  - PATCH 404  → composant inconnu
 *  - PATCH 404  → bindingId inconnu
 *  - PATCH 400  → payload invalide
 *  - DELETE 200 → suppression effective
 *  - DELETE 401 → sans session
 *  - DELETE 404 → bindingId inconnu
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { PATCH, DELETE } from '@/app/api/admin/components/[key]/bindings/[bindingId]/route';
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

async function setupComponentAndBinding() {
  const cmp = await upsertSiteComponentFromSeed(SEED);
  const m = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: 'hero-1',
    alt: 'Hero',
    caption: null,
    credit: null,
    originalFilename: 'h.png',
    originalMime: 'image/png',
    originalSizeBytes: 1024,
    originalUrl: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    createdBy: null,
  });
  const binding = await upsertBinding({
    componentId: cmp.id,
    slot: 'primary',
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
  return { cmp, m, binding };
}

function patchReq(body: unknown) {
  return new Request('http://localhost/api/admin/components/home-hero/bindings/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function delReq() {
  return new Request('http://localhost/api/admin/components/home-hero/bindings/x', {
    method: 'DELETE',
  });
}

describe('PATCH /api/admin/components/[key]/bindings/[bindingId]', () => {
  it('toggle isActive=true', async () => {
    const { cmp, binding } = await setupComponentAndBinding();
    const res = await PATCH(patchReq({ isActive: true }), {
      params: { key: 'home-hero', bindingId: binding.id },
    });
    expect(res.status).toBe(200);
    const persisted = await listBindingsByComponent(cmp.id);
    expect(persisted[0]?.isActive).toBe(true);
  });

  it('401 sans session', async () => {
    const { binding } = await setupComponentAndBinding();
    sessionMock = null;
    const res = await PATCH(patchReq({ isActive: true }), {
      params: { key: 'home-hero', bindingId: binding.id },
    });
    expect(res.status).toBe(401);
  });

  it('404 composant inconnu', async () => {
    const res = await PATCH(patchReq({ isActive: true }), {
      params: { key: 'inconnu', bindingId: 'whatever' },
    });
    expect(res.status).toBe(404);
  });

  it('404 bindingId inconnu', async () => {
    await setupComponentAndBinding();
    const res = await PATCH(patchReq({ isActive: true }), {
      params: { key: 'home-hero', bindingId: 'bnd_does_not_exist' },
    });
    expect(res.status).toBe(404);
  });

  it('400 payload invalide', async () => {
    const { binding } = await setupComponentAndBinding();
    const res = await PATCH(patchReq({ isActive: 'oui' }), {
      params: { key: 'home-hero', bindingId: binding.id },
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/components/[key]/bindings/[bindingId]', () => {
  it('supprime le binding', async () => {
    const { cmp, binding } = await setupComponentAndBinding();
    const res = await DELETE(delReq(), {
      params: { key: 'home-hero', bindingId: binding.id },
    });
    expect(res.status).toBe(200);
    const persisted = await listBindingsByComponent(cmp.id);
    expect(persisted).toHaveLength(0);
  });

  it('401 sans session', async () => {
    const { binding } = await setupComponentAndBinding();
    sessionMock = null;
    const res = await DELETE(delReq(), {
      params: { key: 'home-hero', bindingId: binding.id },
    });
    expect(res.status).toBe(401);
  });

  it('404 bindingId inconnu', async () => {
    await setupComponentAndBinding();
    const res = await DELETE(delReq(), {
      params: { key: 'home-hero', bindingId: 'bnd_xxx' },
    });
    expect(res.status).toBe(404);
  });
});
