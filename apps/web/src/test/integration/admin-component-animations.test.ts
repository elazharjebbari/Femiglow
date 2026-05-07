/**
 * Suite intégration MSW — POST /api/admin/components/[key]/animations.
 *
 * Couvre :
 *  - 200 → upsert d'un binding d'animation par défaut
 *  - 200 → ré-upsert même clé idempotent
 *  - 200 → bascule de default entre deux profils
 *  - 401 → sans session
 *  - 404 → composant inconnu
 *  - 404 → animationKey inconnue
 *  - 400 → payload invalide (sans animationKey)
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

import { POST } from '@/app/api/admin/components/[key]/animations/route';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import {
  upsertAnimationFromSeed,
  listAnimationBindings,
} from '@/lib/db/queries/component-animations';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [{ key: 'primary', label: 'V', required: true, acceptKinds: ['image'] }],
  defaultSvgFallback: null,
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

async function seedTwoAnimations() {
  await upsertAnimationFromSeed({
    key: 'fade-in',
    name: 'Fade-in',
    kind: 'framer-motion',
    description: '',
    config: {},
    respectsReducedMotion: true,
    previewSnippet: null,
  });
  await upsertAnimationFromSeed({
    key: 'reveal-up',
    name: 'Reveal-up',
    kind: 'framer-motion',
    description: '',
    config: {},
    respectsReducedMotion: true,
    previewSnippet: null,
  });
}

function buildReq(body: unknown) {
  return new Request('http://localhost/api/admin/components/home-hero/animations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/components/[key]/animations', () => {
  it('upsert animation par défaut', async () => {
    const cmp = await upsertSiteComponentFromSeed(SEED);
    await seedTwoAnimations();
    const res = await POST(buildReq({ animationKey: 'fade-in', isDefault: true }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.binding.componentId).toBe(cmp.id);
    expect(body.binding.isDefault).toBe(true);
    expect(body.animation.key).toBe('fade-in');
  });

  it('ré-upsert idempotent', async () => {
    await upsertSiteComponentFromSeed(SEED);
    await seedTwoAnimations();
    await POST(buildReq({ animationKey: 'fade-in', isDefault: true }), {
      params: { key: 'home-hero' },
    });
    const res = await POST(buildReq({ animationKey: 'fade-in', isDefault: true }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(200);
  });

  it('bascule du default entre deux profils', async () => {
    const cmp = await upsertSiteComponentFromSeed(SEED);
    await seedTwoAnimations();
    await POST(buildReq({ animationKey: 'fade-in', isDefault: true }), {
      params: { key: 'home-hero' },
    });
    await POST(buildReq({ animationKey: 'reveal-up', isDefault: true }), {
      params: { key: 'home-hero' },
    });
    const bindings = await listAnimationBindings(cmp.id);
    const defaults = bindings.filter((b) => b.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('401 sans session', async () => {
    sessionMock = null;
    await upsertSiteComponentFromSeed(SEED);
    await seedTwoAnimations();
    const res = await POST(buildReq({ animationKey: 'fade-in' }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(401);
  });

  it('404 composant inconnu', async () => {
    await seedTwoAnimations();
    const res = await POST(buildReq({ animationKey: 'fade-in' }), {
      params: { key: 'inconnu' },
    });
    expect(res.status).toBe(404);
  });

  it('404 animationKey inconnue', async () => {
    await upsertSiteComponentFromSeed(SEED);
    const res = await POST(buildReq({ animationKey: 'pas-existant' }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(404);
  });

  it('400 payload invalide', async () => {
    await upsertSiteComponentFromSeed(SEED);
    const res = await POST(buildReq({}), { params: { key: 'home-hero' } });
    expect(res.status).toBe(400);
  });
});
