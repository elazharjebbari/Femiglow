/**
 * Suite intégration MSW — POST /api/admin/components/[key]/bindings.
 *
 * Couvre :
 *  - bindings-success-create   → 200 + binding inactif par défaut
 *  - bindings-success-activate → 200 + isActive=true honoré
 *  - bindings-unauthorized     → 401 sans session
 *  - bindings-component-404    → 404 si componentKey inconnu
 *  - bindings-slot-invalid     → 400 si slot pas dans le composant
 *  - bindings-kind-mismatch    → 400 si media.kind incompatible avec slot.acceptKinds
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

import { POST } from '@/app/api/admin/components/[key]/bindings/route';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia } from '@/lib/db/queries/media';
import { listBindingsByComponent } from '@/lib/db/queries/component-bindings';
import type { SiteComponentSeed } from '@/lib/components/registry';

const SEED: SiteComponentSeed = {
  key: 'home-hero',
  name: 'Hero Accueil',
  description: '',
  category: 'hero',
  pageGroup: 'home',
  filePath: 'src/components/sections/Hero.tsx',
  slots: [
    {
      key: 'primary',
      label: 'Visuel principal',
      required: true,
      acceptKinds: ['image'],
    },
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

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/admin/components/home-hero/bindings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function setupComponent() {
  return upsertSiteComponentFromSeed(SEED);
}

async function setupImageMedia() {
  return createMedia({
    kind: 'image',
    source: 'upload',
    slug: 'hero-1',
    alt: 'Photo hero',
    caption: null,
    credit: null,
    originalFilename: 'hero.png',
    originalMime: 'image/png',
    originalSizeBytes: 1024,
    originalUrl: null,
    qualityProfile: 'hero',
    loadingStrategy: 'eager',
    isHero: true,
    createdBy: null,
  });
}

describe('POST /api/admin/components/[key]/bindings', () => {
  it('crée un binding inactif par défaut', async () => {
    const cmp = await setupComponent();
    const m = await setupImageMedia();
    const res = await POST(buildRequest({ slot: 'primary', mediaId: m.id }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.binding).toMatchObject({
      componentId: cmp.id,
      slot: 'primary',
      mediaId: m.id,
      isActive: false,
    });
    const persisted = await listBindingsByComponent(cmp.id);
    expect(persisted).toHaveLength(1);
  });

  it('honore isActive=true si fourni', async () => {
    await setupComponent();
    const m = await setupImageMedia();
    const res = await POST(
      buildRequest({ slot: 'primary', mediaId: m.id, isActive: true }),
      { params: { key: 'home-hero' } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.binding.isActive).toBe(true);
  });

  it('401 sans session admin', async () => {
    sessionMock = null;
    const cmp = await setupComponent();
    const m = await setupImageMedia();
    const res = await POST(buildRequest({ slot: 'primary', mediaId: m.id }), {
      params: { key: 'home-hero' },
    });
    expect(res.status).toBe(401);
    expect(await listBindingsByComponent(cmp.id)).toHaveLength(0);
  });

  it('404 si componentKey inconnu', async () => {
    const m = await setupImageMedia();
    const res = await POST(buildRequest({ slot: 'primary', mediaId: m.id }), {
      params: { key: 'inexistant' },
    });
    expect(res.status).toBe(404);
  });

  it('400 si slot pas dans la définition du composant', async () => {
    await setupComponent();
    const m = await setupImageMedia();
    const res = await POST(
      buildRequest({ slot: 'inconnu', mediaId: m.id }),
      { params: { key: 'home-hero' } },
    );
    expect(res.status).toBe(400);
  });

  it('400 si media.kind incompatible avec slot.acceptKinds', async () => {
    await setupComponent();
    const video = await createMedia({
      kind: 'video',
      source: 'upload',
      slug: 'vid-1',
      alt: 'Vidéo',
      caption: null,
      credit: null,
      originalFilename: 'v.mp4',
      originalMime: 'video/mp4',
      originalSizeBytes: 1024,
      originalUrl: null,
      qualityProfile: 'inline',
      loadingStrategy: 'viewport',
      isHero: false,
      createdBy: null,
    });
    const res = await POST(
      buildRequest({ slot: 'primary', mediaId: video.id }),
      { params: { key: 'home-hero' } },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.message).toMatch(/image.*video/i);
  });
});
