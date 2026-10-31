/**
 * Suite intégration — API admin « médias par audience » (PR 5).
 *
 * Routes couvertes (memoryStore) :
 *  - GET    /api/admin/components/[key]/media-sets            (liste + couverture)
 *  - PUT    /api/admin/components/[key]/media-sets/draft
 *  - POST   /api/admin/components/[key]/media-sets/[setId]/publish
 *  - POST   /api/admin/components/[key]/media-sets/[setId]/schedule
 *  - POST   /api/admin/components/[key]/media-sets/[setId]/cancel-schedule
 *  - POST   /api/admin/components/[key]/media-sets/[setId]/unpublish
 *  - DELETE /api/admin/components/[key]/media-sets/[setId]     (abandon de brouillon)
 *  - GET    /api/admin/components/[key]/media-sets/history
 *  - POST   /api/admin/components/[key]/media-sets/restore
 *  - POST   /api/admin/components/[key]/media-sets/bulk-publish
 *  - GET    /api/admin/components/[key]/media-sets/resolve
 *  - crons  promote-scheduled-fields + promote-now (section `mediaSets`)
 *  - médias PATCH / DELETE / regenerate (invalidation + 409 « en usage »)
 *
 * Modèle : `admin-component-fields.test.ts`.
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7, §5
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import type { AdminSession } from '@/lib/auth/session';

const freshSession = (): AdminSession => ({
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
});
let sessionMock: AdminSession | null = freshSession();

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

const SITE = 'https://femiglow.test';
vi.mock('@/lib/env', () => ({
  // NEXT_PUBLIC_SITE_URL renseigné : `requireSameOrigin` est réellement actif.
  env: { CRON_SECRET: 'test-cron-secret', NEXT_PUBLIC_SITE_URL: 'https://femiglow.test' },
}));

import { GET as listSets } from '@/app/api/admin/components/[key]/media-sets/route';
import { PUT as putDraft } from '@/app/api/admin/components/[key]/media-sets/draft/route';
import { DELETE as discardSet } from '@/app/api/admin/components/[key]/media-sets/[setId]/route';
import { POST as publishRoute } from '@/app/api/admin/components/[key]/media-sets/[setId]/publish/route';
import { POST as scheduleRoute } from '@/app/api/admin/components/[key]/media-sets/[setId]/schedule/route';
import { POST as cancelScheduleRoute } from '@/app/api/admin/components/[key]/media-sets/[setId]/cancel-schedule/route';
import { POST as unpublishRoute } from '@/app/api/admin/components/[key]/media-sets/[setId]/unpublish/route';
import { GET as historyRoute } from '@/app/api/admin/components/[key]/media-sets/history/route';
import { POST as restoreRoute } from '@/app/api/admin/components/[key]/media-sets/restore/route';
import { POST as bulkPublishRoute } from '@/app/api/admin/components/[key]/media-sets/bulk-publish/route';
import { GET as resolveRoute } from '@/app/api/admin/components/[key]/media-sets/resolve/route';
import { POST as cronPromote } from '@/app/api/cron/promote-scheduled-fields/route';
import { POST as promoteNow } from '@/app/api/admin/components/cron/promote-now/route';
import { DELETE as deleteMediaRoute, PATCH as patchMediaRoute } from '@/app/api/admin/media/[id]/route';
import { POST as regenerateMediaRoute } from '@/app/api/admin/media/[id]/regenerate/route';
import { POST as mediaOptimizeCron } from '@/app/api/cron/media-optimize/route';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { upsertSiteComponentFromSeed } from '@/lib/db/queries/site-components';
import { createMedia, findMediaById, softDeleteMedia } from '@/lib/db/queries/media';
import { createVariant } from '@/lib/db/queries/media-variants';
import {
  getSetById,
  listSetsByComponent,
  publishSet,
  scheduleSet,
  upsertDraftSet,
} from '@/lib/db/queries/component-media-sets';
import { KIT_HERO_MEDIA_VARIANTS, type SiteComponentSeed } from '@/lib/components/registry';
import { KIT_ANGLES } from '@/lib/kit/angle';
import { LOCALES } from '@/i18n.config';
import type { ComponentMediaSetWithItems, Media } from '@/lib/db/types';

const KEY = 'kit-hero-produit';
const MEDIA_SETS_TAG = `components:media-sets:${KEY}`;

const SEED: SiteComponentSeed = {
  key: KEY,
  name: 'Hero Kit (produit)',
  description: 'test',
  category: 'hero',
  pageGroup: 'kit',
  filePath: 'src/components/sections/HeroProduit.tsx',
  slots: [
    { key: 'primary', label: 'Primary', required: true, acceptKinds: ['image'] },
    { key: 'context_1', label: 'C1', required: false, acceptKinds: ['image'] },
    { key: 'context_2', label: 'C2', required: false, acceptKinds: ['image'] },
  ],
  defaultSvgFallback: null,
  defaultLoadingStrategy: 'eager',
  defaultFetchPriority: 'high',
  supportsAnimation: true,
  mediaVariants: KIT_HERO_MEDIA_VARIANTS,
};

/** Composant SANS politique `mediaVariants` (→ 422). */
const SEED_NO_POLICY: SiteComponentSeed = {
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
};

let componentId: string;
let m1: Media;
let m2: Media;
let m3: Media;

async function makeMedia(slug: string): Promise<Media> {
  const m = await createMedia({ kind: 'image', source: 'upload', slug, alt: `Alt ${slug}`, status: 'ready' });
  await createVariant({
    mediaId: m.id,
    format: 'webp',
    breakpoint: 'lg',
    width: 1200,
    height: 1500,
    sizeBytes: 1000,
    url: `/_media/${slug}/lg.webp`,
    checksum: `${slug}-lg`,
  });
  await createVariant({
    mediaId: m.id,
    format: 'webp',
    breakpoint: 'xs',
    width: 320,
    height: 400,
    sizeBytes: 100,
    url: `/_media/${slug}/xs.webp`,
    checksum: `${slug}-xs`,
  });
  return m;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  sessionMock = freshSession();
  revalidateTagMock.mockClear();
});
afterAll(() => server.close());

beforeEach(async () => {
  resetMemoryStore();
  componentId = (await upsertSiteComponentFromSeed(SEED)).id;
  await upsertSiteComponentFromSeed(SEED_NO_POLICY);
  m1 = await makeMedia('m1');
  m2 = await makeMedia('m2');
  m3 = await makeMedia('m3');
});

/* ──────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────── */

const BASE = `http://x/api/admin/components/${KEY}/media-sets`;

/** Requête JSON ; `origin` du site par défaut (CSRF), surchargeable. */
function req(url: string, init: RequestInit & { json?: unknown } = {}): Request {
  const { json, headers, ...rest } = init;
  return new Request(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      origin: SITE,
      ...(headers as Record<string, string> | undefined),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
}

const keyCtx = (key = KEY) => ({ params: { key } });
const setCtx = (setId: string, key = KEY) => ({ params: { key, setId } });

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

async function draft(overrides: Partial<Parameters<typeof upsertDraftSet>[0]> = {}): Promise<ComponentMediaSetWithItems> {
  return upsertDraftSet({
    componentId,
    slot: 'primary',
    variantDim: 'angle',
    variantKey: 'e',
    locale: 'ar',
    items: [{ mediaId: m1.id }],
    authorId: 'adm_1',
    ...overrides,
  });
}

async function published(overrides: Partial<Parameters<typeof upsertDraftSet>[0]> = {}) {
  const d = await draft(overrides);
  return publishSet({ setId: d.id, actorId: 'adm_1' });
}

function revalidatedTags(): unknown[] {
  return revalidateTagMock.mock.calls.map((c) => c[0]);
}

function auditActions(): string[] {
  return Array.from(memoryStore().auditEvents.values()).map((e) => e.action);
}

/** Programme un brouillon puis recule son échéance dans le passé (memoryStore). */
async function dueScheduledSet(overrides: Partial<Parameters<typeof upsertDraftSet>[0]> = {}) {
  const d = await draft(overrides);
  const s = await scheduleSet({ setId: d.id, actorId: 'adm_1', scheduledAt: new Date(Date.now() + 3_600_000) });
  const store = memoryStore();
  store.componentMediaSets.set(s.id, { ...store.componentMediaSets.get(s.id)!, scheduledAt: new Date(Date.now() - 60_000) });
  return s;
}

/* ──────────────────────────────────────────────────────────────────
 * Garde-fous communs
 * ────────────────────────────────────────────────────────────────── */

describe('garde-fous communs', () => {
  it('401 sans session (liste, brouillon, publication, résolution)', async () => {
    sessionMock = null;
    const d = await draft();
    const responses = await Promise.all([
      listSets(req(BASE), keyCtx()),
      putDraft(req(`${BASE}/draft`, { method: 'PUT', json: { slot: 'primary', items: [{ mediaId: m1.id }] } }), keyCtx()),
      publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST' }), setCtx(d.id)),
      resolveRoute(req(`${BASE}/resolve`), keyCtx()),
      bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: {} }), keyCtx()),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    expect((await getSetById(d.id))?.status).toBe('draft');
  });

  it('404 composant inconnu', async () => {
    const res = await listSets(req('http://x/api/admin/components/zzz/media-sets'), keyCtx('zzz'));
    expect(res.status).toBe(404);
  });

  it('422 composant sans politique mediaVariants', async () => {
    const res = await putDraft(
      req('http://x/api/admin/components/home-hero/media-sets/draft', {
        method: 'PUT',
        json: { slot: 'primary', items: [{ mediaId: m1.id }] },
      }),
      keyCtx('home-hero'),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('validation_failed');
  });

  it('404 ensemble d’un autre composant (pas de fuite entre composants)', async () => {
    const d = await draft();
    const res = await publishRoute(
      req(`http://x/api/admin/components/home-hero/media-sets/${d.id}/publish`, { method: 'POST' }),
      setCtx(d.id, 'home-hero'),
    );
    // home-hero n'a pas de politique → 422 avant même la recherche de l'ensemble.
    expect(res.status).toBe(422);
    const res2 = await publishRoute(req(`${BASE}/cms_unknown/publish`, { method: 'POST' }), setCtx('cms_unknown'));
    expect(res2.status).toBe(404);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * PUT /draft
 * ────────────────────────────────────────────────────────────────── */

describe('PUT /media-sets/draft', () => {
  const payload = (over: Record<string, unknown> = {}) => ({
    slot: 'secondary',
    variantDim: 'angle',
    variantKey: 'e',
    locale: 'ar',
    crossLocale: false,
    items: [
      { mediaId: m1.id, alt: { ar: 'صورة', fr: 'Image' }, focalX: 50, focalY: 40 },
      { mediaId: m2.id, mobileMediaId: m3.id, objectPosition: 'top' },
    ],
    notes: 'import manuel',
    ...over,
  });

  it('201 crée le brouillon, 200 le met à jour avec If-Match, audit sans invalidation', async () => {
    const res = await putDraft(req(`${BASE}/draft`, { method: 'PUT', json: payload() }), keyCtx());
    expect(res.status).toBe(201);
    const created = ((await res.json()) as { set: ComponentMediaSetWithItems & { updatedAt: string } }).set;
    expect(created.status).toBe('draft');
    expect(created.items.map((i) => i.mediaId)).toEqual([m1.id, m2.id]);
    expect(created.items[1]?.mobileMediaId).toBe(m3.id);

    const res2 = await putDraft(
      req(`${BASE}/draft`, {
        method: 'PUT',
        headers: { 'if-match': created.updatedAt },
        json: payload({ items: [{ mediaId: m3.id }] }),
      }),
      keyCtx(),
    );
    expect(res2.status).toBe(200);
    const updated = ((await res2.json()) as { set: ComponentMediaSetWithItems }).set;
    expect(updated.id).toBe(created.id);
    expect(updated.items.map((i) => i.mediaId)).toEqual([m3.id]);

    expect(auditActions()).toEqual(['media_set.draft.create', 'media_set.draft.update']);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('accepte expectedUpdatedAt dans le corps', async () => {
    const d = await draft({ slot: 'secondary' });
    const res = await putDraft(
      req(`${BASE}/draft`, {
        method: 'PUT',
        json: payload({ items: [{ mediaId: m2.id }], expectedUpdatedAt: d.updatedAt.toISOString() }),
      }),
      keyCtx(),
    );
    expect(res.status).toBe(200);
  });

  it('409 If-Match désynchronisé, avec l’état courant', async () => {
    const d = await draft({ slot: 'secondary' });
    const res = await putDraft(
      req(`${BASE}/draft`, {
        method: 'PUT',
        headers: { 'if-match': '1900-01-01T00:00:00.000Z' },
        json: payload(),
      }),
      keyCtx(),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('version_conflict');
    const current = body.error.details?.current as { id: string; items: unknown[] };
    expect(current.id).toBe(d.id);
    expect(current.items).toHaveLength(1);
    expect(body.error.details?.remoteUpdatedAt).toBe(d.updatedAt.toISOString());
  });

  it('400 If-Match non parsable, payload mal formé ou champ inconnu', async () => {
    const bad = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', headers: { 'if-match': 'pas-une-date' }, json: payload() }),
      keyCtx(),
    );
    expect(bad.status).toBe(400);
    const extra = await putDraft(req(`${BASE}/draft`, { method: 'PUT', json: payload({ hacker: true }) }), keyCtx());
    expect(extra.status).toBe(400);
    const focal = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', json: payload({ items: [{ mediaId: m1.id, focalX: 140 }] }) }),
      keyCtx(),
    );
    expect(focal.status).toBe(400);
    const notJson = await putDraft(
      new Request(`${BASE}/draft`, {
        method: 'PUT',
        body: '{oops',
        headers: { 'content-type': 'application/json', origin: SITE },
      }),
      keyCtx(),
    );
    expect(notJson.status).toBe(400);
  });

  it('422 slot inconnu, trop d’images, média supprimé', async () => {
    const unknownSlot = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', json: payload({ slot: 'tertiary' }) }),
      keyCtx(),
    );
    expect(unknownSlot.status).toBe(422);
    const b1 = (await unknownSlot.json()) as ErrorBody;
    expect((b1.error.details?.issues as Array<{ code: string }>).map((i) => i.code)).toContain('slot.unknown');

    const sevenItems = Array.from({ length: 7 }, () => ({ mediaId: m1.id }));
    const tooMany = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', json: payload({ items: sevenItems }) }),
      keyCtx(),
    );
    expect(tooMany.status).toBe(422);
    const b2 = (await tooMany.json()) as ErrorBody;
    expect((b2.error.details?.issues as Array<{ code: string }>).map((i) => i.code)).toContain('items.too_many');

    await softDeleteMedia(m2.id);
    const deleted = await putDraft(req(`${BASE}/draft`, { method: 'PUT', json: payload() }), keyCtx());
    expect(deleted.status).toBe(422);
    const b3 = (await deleted.json()) as ErrorBody;
    expect((b3.error.details?.issues as Array<{ code: string }>).map((i) => i.code)).toContain('item.media_deleted');

    expect(await listSetsByComponent(componentId)).toHaveLength(0);
  });

  it('422 clé de variante invalide pour la dimension', async () => {
    const res = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', json: payload({ variantKey: 'zz' }) }),
      keyCtx(),
    );
    expect(res.status).toBe(422);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Cycle de vie
 * ────────────────────────────────────────────────────────────────── */

describe('POST /[setId]/publish', () => {
  it('200 publie, archive l’ancien publié, invalide les deux tags, audite', async () => {
    const v1 = await published();
    const d = await draft({ items: [{ mediaId: m2.id }] });
    revalidateTagMock.mockClear();

    const res = await publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST', json: { notes: 'go' } }), setCtx(d.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { set: { status: string; version: number }; revalidated: string[] };
    expect(body.set.status).toBe('published');
    expect(body.set.version).toBe(2);
    expect((await getSetById(v1.id))?.status).toBe('archived');

    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    expect(body.revalidated).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    const audit = Array.from(memoryStore().auditEvents.values()).find((e) => e.action === 'media_set.publish');
    expect(audit?.resourceType).toBe('component_media_set');
    expect(audit?.meta).toMatchObject({ componentKey: KEY, slot: 'primary', variantKey: 'e', notes: 'go' });
  });

  it('409 If-Match désynchronisé, rien n’est publié ni invalidé', async () => {
    const d = await draft();
    const res = await publishRoute(
      req(`${BASE}/${d.id}/publish`, { method: 'POST', headers: { 'if-match': '2000-01-01T00:00:00.000Z' } }),
      setCtx(d.id),
    );
    expect(res.status).toBe(409);
    expect((await getSetById(d.id))?.status).toBe('draft');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('409 invalid_state sur un ensemble déjà publié', async () => {
    const p = await published();
    const res = await publishRoute(req(`${BASE}/${p.id}/publish`, { method: 'POST' }), setCtx(p.id));
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('invalid_state');
    expect(body.error.details?.reason).toBe('publish.invalid_status:published');
  });

  it('422 si un média a été supprimé depuis le brouillon', async () => {
    const d = await draft();
    await softDeleteMedia(m1.id);
    const res = await publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST' }), setCtx(d.id));
    expect(res.status).toBe(422);
  });
});

describe('POST /[setId]/schedule + cancel-schedule', () => {
  it('programme sans invalider, puis annule (retour en brouillon)', async () => {
    const d = await draft();
    const at = new Date(Date.now() + 2 * 3_600_000).toISOString();
    const res = await scheduleRoute(req(`${BASE}/${d.id}/schedule`, { method: 'POST', json: { scheduledAt: at } }), setCtx(d.id));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { set: { status: string; scheduledAt: string } };
    expect(body.set.status).toBe('scheduled');
    expect(body.set.scheduledAt).toBe(at);
    expect(revalidateTagMock).not.toHaveBeenCalled();

    const res2 = await cancelScheduleRoute(req(`${BASE}/${d.id}/cancel-schedule`, { method: 'POST' }), setCtx(d.id));
    expect(res2.status).toBe(200);
    expect((await getSetById(d.id))?.status).toBe('draft');
    expect(auditActions()).toEqual(['media_set.schedule', 'media_set.cancel_schedule']);
  });

  it('400 date passée (zod) et 400 schedule_in_past (< 1 min, couche requêtes)', async () => {
    const d = await draft();
    const past = await scheduleRoute(
      req(`${BASE}/${d.id}/schedule`, { method: 'POST', json: { scheduledAt: '2000-01-01T00:00:00Z' } }),
      setCtx(d.id),
    );
    expect(past.status).toBe(400);
    const soon = await scheduleRoute(
      req(`${BASE}/${d.id}/schedule`, { method: 'POST', json: { scheduledAt: new Date(Date.now() + 10_000).toISOString() } }),
      setCtx(d.id),
    );
    expect(soon.status).toBe(400);
    expect(((await soon.json()) as ErrorBody).error.code).toBe('schedule_in_past');
  });

  it('409 cancel-schedule sur un brouillon', async () => {
    const d = await draft();
    const res = await cancelScheduleRoute(req(`${BASE}/${d.id}/cancel-schedule`, { method: 'POST' }), setCtx(d.id));
    expect(res.status).toBe(409);
  });
});

describe('POST /[setId]/unpublish + DELETE /[setId]', () => {
  it('dépublie (archivé) et invalide les deux tags', async () => {
    const p = await published();
    revalidateTagMock.mockClear();
    const res = await unpublishRoute(req(`${BASE}/${p.id}/unpublish`, { method: 'POST' }), setCtx(p.id));
    expect(res.status).toBe(200);
    expect((await getSetById(p.id))?.status).toBe('archived');
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
  });

  it('abandonne un brouillon (supprimé, historique conservé), refuse un publié', async () => {
    const d = await draft();
    const res = await discardSet(req(`${BASE}/${d.id}`, { method: 'DELETE' }), setCtx(d.id));
    expect(res.status).toBe(200);
    expect(await getSetById(d.id)).toBeNull();
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(auditActions()).toContain('media_set.discard');

    const p = await published();
    const res2 = await discardSet(req(`${BASE}/${p.id}`, { method: 'DELETE' }), setCtx(p.id));
    expect(res2.status).toBe(409);
    expect((await getSetById(p.id))?.status).toBe('published');
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Historique + restauration
 * ────────────────────────────────────────────────────────────────── */

describe('GET /history + POST /restore', () => {
  it('liste l’historique d’une cellule puis restaure une version en brouillon', async () => {
    const v1 = await published({ items: [{ mediaId: m1.id }] });
    await published({ items: [{ mediaId: m2.id }] });

    const res = await historyRoute(
      req(`${BASE}/history?slot=primary&variantDim=angle&variantKey=e&locale=ar&limit=10`),
      keyCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ id: string; action: string; version: number; setId: string; items: Array<{ mediaId: string; thumbUrl: string | null }> }>;
    };
    expect(body.entries[0]?.action).toBe('publish');
    const firstPublish = body.entries.find((e) => e.action === 'publish' && e.setId === v1.id)!;
    expect(firstPublish.items[0]?.mediaId).toBe(m1.id);
    expect(firstPublish.items[0]?.thumbUrl).toBe('/_media/m1/xs.webp');

    const restore = await restoreRoute(
      req(`${BASE}/restore`, { method: 'POST', json: { historyId: firstPublish.id } }),
      keyCtx(),
    );
    expect(restore.status).toBe(200);
    const restored = (await restore.json()) as { set: ComponentMediaSetWithItems; restoredFromVersion: number };
    expect(restored.set.status).toBe('draft');
    expect(restored.set.items.map((i) => i.mediaId)).toEqual([m1.id]);
    expect(restored.restoredFromVersion).toBe(1);
    expect(auditActions()).toContain('media_set.restore');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('400 history sans slot, 404 restore d’une entrée inconnue', async () => {
    const res = await historyRoute(req(`${BASE}/history`), keyCtx());
    expect(res.status).toBe(400);
    const res2 = await restoreRoute(req(`${BASE}/restore`, { method: 'POST', json: { historyId: 'cmsh_nope' } }), keyCtx());
    expect(res2.status).toBe(404);
  });

  it('422 restauration d’une version dont un média a été supprimé', async () => {
    const p = await published();
    const entry = Array.from(memoryStore().componentMediaSetHistory.values()).find(
      (e) => e.setId === p.id && e.action === 'publish',
    )!;
    await softDeleteMedia(m1.id);
    const res = await restoreRoute(req(`${BASE}/restore`, { method: 'POST', json: { historyId: entry.id } }), keyCtx());
    expect(res.status).toBe(422);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Publication en masse
 * ────────────────────────────────────────────────────────────────── */

describe('POST /bulk-publish', () => {
  async function seedDrafts() {
    const a = await draft({ variantKey: 'a', locale: 'fr', source: 'import' });
    const b = await draft({ variantKey: 'b', locale: 'fr', source: 'import' });
    const c = await draft({ variantKey: 'c', locale: 'fr', source: 'admin' });
    return { a, b, c };
  }

  it('dryRun : liste sans publier ni invalider', async () => {
    const pub = await published({ variantKey: 'a', locale: 'fr', items: [{ mediaId: m3.id }] });
    revalidateTagMock.mockClear();
    const { a, b } = await seedDrafts();
    const res = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: { source: 'import' }, dryRun: true } }),
      keyCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      dryRun: boolean;
      matched: number;
      results: Array<{ setId: string; replacesPublished: { setId: string } | null; warnings: string[] }>;
    };
    expect(body.dryRun).toBe(true);
    expect(body.matched).toBe(2);
    expect(body.results.map((r) => r.setId).sort()).toEqual([a.id, b.id].sort());
    expect(body.results.find((r) => r.setId === a.id)?.replacesPublished?.setId).toBe(pub.id);
    expect((await getSetById(a.id))?.status).toBe('draft');
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(auditActions()).not.toContain('media_set.bulk_publish');
  });

  it('réel : publie chaque brouillon indépendamment, rapporte les échecs, invalide une fois', async () => {
    const { a, b, c } = await seedDrafts();
    // b devient impubliable (média supprimé) : son échec ne bloque pas a.
    await upsertDraftSet({
      componentId,
      slot: 'primary',
      variantDim: 'angle',
      variantKey: 'b',
      locale: 'fr',
      items: [{ mediaId: m2.id }],
      authorId: null,
    });
    await softDeleteMedia(m2.id);

    const res = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: { source: 'import', slot: 'primary' } } }),
      keyCtx(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      published: number;
      failed: number;
      results: Array<{ setId: string; ok: boolean; error?: { code: string } }>;
    };
    expect(body.published).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.results.find((r) => r.setId === a.id)?.ok).toBe(true);
    expect(body.results.find((r) => r.setId === b.id)?.error?.code).toBe('validation_failed');
    expect((await getSetById(a.id))?.status).toBe('published');
    expect((await getSetById(b.id))?.status).toBe('draft');
    expect((await getSetById(c.id))?.status).toBe('draft'); // source admin, hors filtre
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    expect(auditActions()).toEqual(expect.arrayContaining(['media_set.publish', 'media_set.bulk_publish']));
  });

  it('400 filtre inconnu', async () => {
    const res = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: { status: 'draft' } } }),
      keyCtx(),
    );
    expect(res.status).toBe(400);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Liste + couverture, diagnostic
 * ────────────────────────────────────────────────────────────────── */

describe('GET /media-sets (liste + couverture)', () => {
  it('renvoie politique, ensembles enrichis et couverture calculée sur les publiés', async () => {
    await published({ variantDim: 'default', variantKey: '*', locale: '*', items: [{ mediaId: m1.id }] });
    await published({ variantKey: 'e', locale: 'ar', items: [{ mediaId: m2.id }] });
    await draft({ variantKey: 'a', locale: 'fr', items: [{ mediaId: m3.id }] });
    await softDeleteMedia(m3.id);

    const res = await listSets(req(BASE), keyCtx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      policy: { slots: Array<{ key: string }> };
      dimensions: Array<{ id: string; values: string[] | null }>;
      sets: Array<{ status: string; variantKey: string; hasUnavailableMedia: boolean; items: Array<{ media: { state: string; thumbUrl: string | null } }> }>;
      coverage: {
        cells: Array<{ slot: string; variantDim: string; variantKey: string; locale: string; level: number; exact: boolean; source: { variantKey: string; locale: string } | null }>;
        summary: { total: number; exact: number; inherited: number; delegated: number };
      };
    };
    expect(body.policy.slots.map((s) => s.key)).toEqual(['primary', 'secondary']);
    expect(body.dimensions).toEqual([{ id: 'angle', label: 'Angle publicitaire', values: [...KIT_ANGLES] }]);
    expect(body.sets).toHaveLength(3);
    const brokenDraft = body.sets.find((s) => s.status === 'draft')!;
    expect(brokenDraft.hasUnavailableMedia).toBe(true);
    expect(brokenDraft.items[0]?.media.state).toBe('deleted');
    const ok = body.sets.find((s) => s.variantKey === 'e')!;
    expect(ok.items[0]?.media).toMatchObject({ state: 'ok', thumbUrl: '/_media/m2/xs.webp' });

    const rows = 1 + KIT_ANGLES.length;
    const total = rows * LOCALES.length * 2;
    expect(body.coverage.summary.total).toBe(total);
    // secondary : aucun ensemble → délégué partout.
    expect(body.coverage.summary.delegated).toBe(total / 2);
    // primary : ligne défaut (3 langues, servie par défaut `*`) + angle e ×
    // ar sont « exactes » (ensemble de leur propre ligne) ; le reste hérite
    // du défaut.
    expect(body.coverage.summary.exact).toBe(LOCALES.length + 1);
    expect(body.coverage.summary.inherited).toBe(total / 2 - LOCALES.length - 1);
    const eAr = body.coverage.cells.find(
      (c) => c.slot === 'primary' && c.variantKey === 'e' && c.locale === 'ar',
    )!;
    expect(eAr).toMatchObject({ level: 1, exact: true });
    const eFr = body.coverage.cells.find(
      (c) => c.slot === 'primary' && c.variantKey === 'e' && c.locale === 'fr',
    )!;
    expect(eFr).toMatchObject({ level: 5, exact: false, source: { variantKey: '*', locale: '*' } });
  });

  it('filtre par statut et langue ; 400 statut inconnu', async () => {
    await published({ variantKey: 'e', locale: 'ar' });
    await draft({ variantKey: 'a', locale: 'fr' });
    const res = await listSets(req(`${BASE}?status=draft&locale=fr`), keyCtx());
    const body = (await res.json()) as { sets: Array<{ status: string }> };
    expect(body.sets.map((s) => s.status)).toEqual(['draft']);
    const bad = await listSets(req(`${BASE}?status=nope`), keyCtx());
    expect(bad.status).toBe(400);
  });
});

describe('GET /media-sets/resolve', () => {
  it('niveau atteint par slot, publié vs aperçu brouillon', async () => {
    await published({ variantKey: 'e', locale: 'ar', items: [{ mediaId: m1.id }] });
    await draft({ variantKey: 'e', locale: 'ar', items: [{ mediaId: m2.id }] });

    const res = await resolveRoute(req(`${BASE}/resolve?angle=e&locale=ar`), keyCtx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      trackingValue: string;
      slots: Array<{ slot: string; level: number; delegated: boolean; images: Array<{ src: string }> | null }>;
    };
    const primary = body.slots.find((s) => s.slot === 'primary')!;
    expect(primary.level).toBe(1);
    expect(primary.images?.[0]?.src).toBe('/_media/m1/lg.webp');
    expect(body.slots.find((s) => s.slot === 'secondary')).toMatchObject({ level: 7, delegated: true });
    expect(body.trackingValue).toBe('angle-e.ar.v1');

    const preview = await resolveRoute(req(`${BASE}/resolve?angle=e&locale=ar&draft=1`), keyCtx());
    const pBody = (await preview.json()) as { slots: Array<{ slot: string; images: Array<{ src: string }> | null }> };
    expect(pBody.slots.find((s) => s.slot === 'primary')?.images?.[0]?.src).toBe('/_media/m2/lg.webp');

    // Langue sans ensemble : repli délégué.
    const fr = await resolveRoute(req(`${BASE}/resolve?angle=e&locale=fr`), keyCtx());
    const frBody = (await fr.json()) as { slots: Array<{ slot: string; level: number }> };
    expect(frBody.slots.find((s) => s.slot === 'primary')?.level).toBe(7);
  });

  it('400 angle ou langue invalide', async () => {
    expect((await resolveRoute(req(`${BASE}/resolve?angle=zz`), keyCtx())).status).toBe(400);
    expect((await resolveRoute(req(`${BASE}/resolve?locale=de`), keyCtx())).status).toBe(400);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Crons
 * ────────────────────────────────────────────────────────────────── */

describe('crons — promotion des ensembles programmés', () => {
  it('promote-scheduled-fields promeut les ensembles échus et invalide (section mediaSets)', async () => {
    const s = await dueScheduledSet();
    const res = await cronPromote(
      req('http://x/api/cron/promote-scheduled-fields', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      promoted: unknown[];
      failed: unknown[];
      mediaSets: { promoted: Array<{ setId: string; componentKey: string }>; failed: unknown[]; revalidated: string[] };
    };
    expect(body.promoted).toEqual([]); // champs : rien
    expect(body.mediaSets.promoted).toEqual([expect.objectContaining({ setId: s.id, componentKey: KEY })]);
    expect((await getSetById(s.id))?.status).toBe('published');
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    expect(auditActions()).toContain('media_set.publish.scheduled');

    // Idempotent.
    revalidateTagMock.mockClear();
    const res2 = await cronPromote(
      req('http://x/api/cron/promote-scheduled-fields', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }),
    );
    const body2 = (await res2.json()) as { mediaSets: { promoted: unknown[] } };
    expect(body2.mediaSets.promoted).toHaveLength(0);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('401 sans Bearer : rien n’est promu', async () => {
    const s = await dueScheduledSet();
    const res = await cronPromote(req('http://x/api/cron/promote-scheduled-fields', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect((await getSetById(s.id))?.status).toBe('scheduled');
  });

  it('une panne des ensembles ne casse pas la promotion des champs', async () => {
    const queries = await import('@/lib/db/queries/component-media-sets');
    const spy = vi.spyOn(queries, 'promoteDueMediaSets').mockRejectedValueOnce(new Error('relation does not exist'));
    try {
      const res = await cronPromote(
        req('http://x/api/cron/promote-scheduled-fields', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { promoted: unknown[]; mediaSets: { error?: string } };
      expect(body.promoted).toEqual([]);
      expect(body.mediaSets.error).toBe('relation does not exist');
    } finally {
      spy.mockRestore();
    }
  });

  it('promote-now (admin) promeut aussi les ensembles échus', async () => {
    const s = await dueScheduledSet({ variantKey: 'c', locale: 'en' });
    const res = await promoteNow(req('http://x/api/admin/components/cron/promote-now', { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mediaSets: { promoted: Array<{ setId: string }> } };
    expect(body.mediaSets.promoted.map((p) => p.setId)).toEqual([s.id]);
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    const audit = Array.from(memoryStore().auditEvents.values()).find((e) => e.action === 'media_set.publish.scheduled');
    expect(audit?.actorId).toBe('adm_1');
    expect(audit?.meta).toMatchObject({ trigger: 'manual' });
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Routes médias : invalidation + 409 « en usage »
 * ────────────────────────────────────────────────────────────────── */

describe('routes médias — invalidation du cache des composants', () => {
  const mediaCtx = (id: string) => ({ params: { id } });

  it('PATCH invalide `components`', async () => {
    const res = await patchMediaRoute(
      req(`http://x/api/admin/media/${m1.id}`, { method: 'PATCH', json: { alt: 'Nouvel alt' } }),
      mediaCtx(m1.id),
    );
    expect(res.status).toBe(200);
    expect(revalidatedTags()).toContain('components');
  });

  it('DELETE simple invalide `components` (un ensemble publié retombe au repli)', async () => {
    await published({ items: [{ mediaId: m1.id }] });
    revalidateTagMock.mockClear();
    const res = await deleteMediaRoute(req(`http://x/api/admin/media/${m1.id}`, { method: 'DELETE' }), mediaCtx(m1.id));
    expect(res.status).toBe(200);
    expect(revalidatedTags()).toContain('components');
    expect((await findMediaById(m1.id))?.deletedAt).not.toBeNull();
  });

  it('DELETE définitif d’un média utilisé → 409 avec la liste des ensembles', async () => {
    const p = await published({ items: [{ mediaId: m1.id }] });
    const res = await deleteMediaRoute(
      req(`http://x/api/admin/media/${m1.id}?hard=true`, { method: 'DELETE' }),
      mediaCtx(m1.id),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('conflict');
    expect(body.error.message).toContain('kit-hero-produit · primary · angle e · ar (publié v1)');
    expect(body.error.details?.usages).toEqual([
      expect.objectContaining({ setId: p.id, componentKey: KEY, status: 'published' }),
    ]);
    expect(await findMediaById(m1.id)).not.toBeNull();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('DELETE définitif d’un média libre → 200 et invalidation', async () => {
    const res = await deleteMediaRoute(
      req(`http://x/api/admin/media/${m3.id}?hard=true`, { method: 'DELETE' }),
      mediaCtx(m3.id),
    );
    expect(res.status).toBe(200);
    expect(await findMediaById(m3.id)).toBeNull();
    expect(revalidatedTags()).toContain('components');
  });

  it('une erreur d’invalidation ne transforme pas un succès en 500', async () => {
    revalidateTagMock.mockImplementationOnce(() => {
      throw new Error('Invariant: static generation store missing');
    });
    const res = await patchMediaRoute(
      req(`http://x/api/admin/media/${m1.id}`, { method: 'PATCH', json: { alt: 'Encore' } }),
      mediaCtx(m1.id),
    );
    expect(res.status).toBe(200);
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Durcissements (revue PR 5)
 * ────────────────────────────────────────────────────────────────── */

/** Second composant AVEC politique — pour les tests d'IDOR. */
const SEED_OTHER: SiteComponentSeed = { ...SEED, key: 'kit-hero-bis', name: 'Hero bis' };

describe('401 sur toutes les routes', () => {
  it('chaque route media-sets refuse sans session, sans rien modifier', async () => {
    const d = await draft();
    sessionMock = null;
    const calls: Array<[string, Promise<Response>]> = [
      ['GET /', listSets(req(BASE), keyCtx())],
      ['PUT /draft', putDraft(req(`${BASE}/draft`, { method: 'PUT', json: { slot: 'primary', items: [{ mediaId: m1.id }] } }), keyCtx())],
      ['POST publish', publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST' }), setCtx(d.id))],
      ['POST schedule', scheduleRoute(req(`${BASE}/${d.id}/schedule`, { method: 'POST', json: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() } }), setCtx(d.id))],
      ['POST cancel-schedule', cancelScheduleRoute(req(`${BASE}/${d.id}/cancel-schedule`, { method: 'POST' }), setCtx(d.id))],
      ['POST unpublish', unpublishRoute(req(`${BASE}/${d.id}/unpublish`, { method: 'POST' }), setCtx(d.id))],
      ['DELETE /[setId]', discardSet(req(`${BASE}/${d.id}`, { method: 'DELETE' }), setCtx(d.id))],
      ['GET /history', historyRoute(req(`${BASE}/history?slot=primary`), keyCtx())],
      ['POST /restore', restoreRoute(req(`${BASE}/restore`, { method: 'POST', json: { historyId: 'x' } }), keyCtx())],
      ['POST /bulk-publish', bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: { all: true } }), keyCtx())],
      ['GET /resolve', resolveRoute(req(`${BASE}/resolve`), keyCtx())],
      ['POST promote-now', promoteNow(req('http://x/api/admin/components/cron/promote-now', { method: 'POST' }))],
    ];
    const statuses = await Promise.all(calls.map(async ([name, p]) => [name, (await p).status] as const));
    expect(statuses.filter(([, status]) => status !== 401)).toEqual([]);
    expect(await getSetById(d.id)).toMatchObject({ status: 'draft', updatedAt: d.updatedAt });
    expect(auditActions()).toEqual([]);
  });
});

describe('CSRF — requireSameOrigin sur les routes mutantes', () => {
  const foreign = { origin: 'https://evil.example' };

  it('403 avec une origine étrangère (ou absente), rien n’est modifié', async () => {
    const d = await draft();
    const p = await published({ variantKey: 'a', locale: 'fr' });
    const h = Array.from(memoryStore().componentMediaSetHistory.values())[0]!;
    const responses = await Promise.all([
      putDraft(req(`${BASE}/draft`, { method: 'PUT', headers: foreign, json: { slot: 'primary', items: [{ mediaId: m1.id }] } }), keyCtx()),
      publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST', headers: foreign }), setCtx(d.id)),
      scheduleRoute(req(`${BASE}/${d.id}/schedule`, { method: 'POST', headers: foreign, json: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() } }), setCtx(d.id)),
      cancelScheduleRoute(req(`${BASE}/${d.id}/cancel-schedule`, { method: 'POST', headers: foreign }), setCtx(d.id)),
      unpublishRoute(req(`${BASE}/${p.id}/unpublish`, { method: 'POST', headers: foreign }), setCtx(p.id)),
      discardSet(req(`${BASE}/${d.id}`, { method: 'DELETE', headers: foreign }), setCtx(d.id)),
      restoreRoute(req(`${BASE}/restore`, { method: 'POST', headers: foreign, json: { historyId: h.id } }), keyCtx()),
      bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', headers: foreign, json: { all: true } }), keyCtx()),
      // Sans Origin ni Referer : refusé aussi.
      publishRoute(new Request(`${BASE}/${d.id}/publish`, { method: 'POST' }), setCtx(d.id)),
    ]);
    expect(responses.map((r) => r.status)).toEqual(Array(9).fill(403));
    expect((await getSetById(d.id))?.status).toBe('draft');
    expect((await getSetById(p.id))?.status).toBe('published');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('les lectures (GET) ne sont pas soumises au contrôle d’origine', async () => {
    const res = await listSets(new Request(BASE), keyCtx());
    expect(res.status).toBe(200);
  });
});

describe('bulk-publish — garde-fous', () => {
  it('400 sans filtre ni `all: true` ; `all: true` publie tous les brouillons', async () => {
    const a = await draft({ variantKey: 'a', locale: 'fr' });
    const b = await draft({ variantKey: 'b', locale: 'fr' });
    const empty = await bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: {} }), keyCtx());
    expect(empty.status).toBe(400);
    const emptyFilter = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: {} } }),
      keyCtx(),
    );
    expect(emptyFilter.status).toBe(400);
    expect((await getSetById(a.id))?.status).toBe('draft');

    const res = await bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: { all: true } }), keyCtx());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { all: boolean; published: number };
    expect(body).toMatchObject({ all: true, published: 2 });
    expect((await getSetById(b.id))?.status).toBe('published');
  });

  it('une erreur interne n’est pas renvoyée brute (message générique + log)', async () => {
    const a = await draft({ variantKey: 'a', locale: 'fr' });
    const queries = await import('@/lib/db/queries/component-media-sets');
    const spy = vi
      .spyOn(queries, 'publishSet')
      .mockRejectedValueOnce(new Error('duplicate key value violates "secret_internal_index"'));
    try {
      const res = await bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: { all: true } }), keyCtx());
      const raw = await res.text();
      expect(raw).not.toContain('secret_internal_index');
      const body = JSON.parse(raw) as { failed: number; results: Array<{ setId: string; error?: { code: string; message: string } }> };
      expect(body.failed).toBe(1);
      expect(body.results.find((r) => r.setId === a.id)?.error).toEqual({
        code: 'internal_error',
        message: 'Erreur interne lors de la publication de cet ensemble',
      });
      expect(revalidateTagMock).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('M2 — audit en échec : la publication reste `ok`, le cache est invalidé, 200', async () => {
    const a = await draft({ variantKey: 'a', locale: 'fr' });
    const audit = await import('@/lib/audit/log-event');
    const spy = vi.spyOn(audit, 'logAuditEvent').mockRejectedValue(new Error('audit db down'));
    try {
      const res = await bulkPublishRoute(req(`${BASE}/bulk-publish`, { method: 'POST', json: { all: true } }), keyCtx());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { published: number; results: Array<{ setId: string; ok: boolean }> };
      expect(body.published).toBe(1);
      expect(body.results).toEqual([expect.objectContaining({ setId: a.id, ok: true })]);
      expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
    } finally {
      spy.mockRestore();
    }
    expect((await getSetById(a.id))?.status).toBe('published');
  });
});

describe('M1 — audit en échec après une mutation committée', () => {
  it('publish : 200, cache invalidé malgré l’échec du journal', async () => {
    const d = await draft();
    const audit = await import('@/lib/audit/log-event');
    const spy = vi.spyOn(audit, 'logAuditEvent').mockRejectedValue(new Error('audit db down'));
    try {
      const res = await publishRoute(req(`${BASE}/${d.id}/publish`, { method: 'POST' }), setCtx(d.id));
      expect(res.status).toBe(200);
      expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
      const draftRes = await putDraft(
        req(`${BASE}/draft`, { method: 'PUT', json: { slot: 'primary', variantDim: 'angle', variantKey: 'a', locale: 'fr', items: [{ mediaId: m1.id }] } }),
        keyCtx(),
      );
      expect(draftRes.status).toBe(201);
    } finally {
      spy.mockRestore();
    }
    expect((await getSetById(d.id))?.status).toBe('published');
  });

  it('DELETE média : 200 et invalidation même si l’audit échoue', async () => {
    const audit = await import('@/lib/audit/log-event');
    const spy = vi.spyOn(audit, 'logAuditEvent').mockRejectedValue(new Error('audit db down'));
    try {
      const res = await deleteMediaRoute(req(`http://x/api/admin/media/${m1.id}`, { method: 'DELETE' }), { params: { id: m1.id } });
      expect(res.status).toBe(200);
      expect(revalidatedTags()).toContain('components');
      const patch = await patchMediaRoute(
        req(`http://x/api/admin/media/${m2.id}`, { method: 'PATCH', json: { alt: 'x' } }),
        { params: { id: m2.id } },
      );
      expect(patch.status).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('IDOR — second composant doté d’une politique', () => {
  it('ensemble ou historique d’un autre composant → 404, rien n’est modifié', async () => {
    const otherId = (await upsertSiteComponentFromSeed(SEED_OTHER)).id;
    const foreignDraft = await upsertDraftSet({
      componentId: otherId,
      slot: 'primary',
      variantDim: 'angle',
      variantKey: 'e',
      locale: 'ar',
      items: [{ mediaId: m1.id }],
      authorId: null,
    });
    const foreignHistory = Array.from(memoryStore().componentMediaSetHistory.values()).find(
      (h) => h.setId === foreignDraft.id,
    )!;

    const responses = await Promise.all([
      publishRoute(req(`${BASE}/${foreignDraft.id}/publish`, { method: 'POST' }), setCtx(foreignDraft.id)),
      scheduleRoute(
        req(`${BASE}/${foreignDraft.id}/schedule`, { method: 'POST', json: { scheduledAt: new Date(Date.now() + 3_600_000).toISOString() } }),
        setCtx(foreignDraft.id),
      ),
      discardSet(req(`${BASE}/${foreignDraft.id}`, { method: 'DELETE' }), setCtx(foreignDraft.id)),
      restoreRoute(req(`${BASE}/restore`, { method: 'POST', json: { historyId: foreignHistory.id } }), keyCtx()),
    ]);
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(await getSetById(foreignDraft.id)).toMatchObject({ status: 'draft', updatedAt: foreignDraft.updatedAt });
    // Aucun brouillon créé côté kit-hero-produit par la restauration croisée.
    expect(await listSetsByComponent(componentId)).toEqual([]);
  });
});

describe('crons — robustesse (revue)', () => {
  const cronReq = () =>
    req('http://x/api/cron/promote-scheduled-fields', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } });

  it('M3 — le bloc champs jette : les ensembles sont promus quand même, réponse 500 détaillée', async () => {
    const s = await dueScheduledSet();
    const fields = await import('@/lib/db/queries/component-fields');
    const spy = vi.spyOn(fields, 'listScheduledDue').mockRejectedValue(new Error('fields table locked'));
    try {
      for (const [name, call] of [
        ['cron', () => cronPromote(cronReq())],
        ['promote-now', () => promoteNow(req('http://x/api/admin/components/cron/promote-now', { method: 'POST' }))],
      ] as const) {
        const res = await call();
        expect(res.status, name).toBe(500);
        const body = (await res.json()) as {
          error: { code: string };
          promoted: unknown[];
          mediaSets: { promoted: Array<{ setId: string }> };
        };
        expect(body.error.code).toBe('internal_error');
        expect(body.promoted).toEqual([]);
        if (name === 'cron') {
          expect(body.mediaSets.promoted.map((p) => p.setId)).toEqual([s.id]);
        }
      }
    } finally {
      spy.mockRestore();
    }
    expect((await getSetById(s.id))?.status).toBe('published');
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
  });

  it('L3 — ensemble programmé avec média supprimé : `stuck` (warn, pas failed) et visible dans GET /', async () => {
    const s = await dueScheduledSet({ items: [{ mediaId: m2.id }] });
    await softDeleteMedia(m2.id);
    const res = await cronPromote(cronReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mediaSets: { stuck: Array<{ setId: string; issues: string[] }>; failed: unknown[]; promoted: unknown[] };
    };
    expect(body.mediaSets.stuck).toEqual([{ setId: s.id, issues: ['item.media_deleted'] }]);
    expect(body.mediaSets.failed).toEqual([]);
    expect(revalidateTagMock).not.toHaveBeenCalled();

    const list = await listSets(req(BASE), keyCtx());
    const listBody = (await list.json()) as {
      stuckScheduled: Array<{ setId: string; reason: string; unavailableMediaIds: string[] }>;
    };
    expect(listBody.stuckScheduled).toEqual([
      expect.objectContaining({ setId: s.id, reason: 'media_unavailable', unavailableMediaIds: [m2.id] }),
    ]);
  });

  it('L2 — clé de composant illisible : `components` est invalidé quand même', async () => {
    const s = await dueScheduledSet();
    const sc = await import('@/lib/db/queries/site-components');
    const spy = vi.spyOn(sc, 'getSiteComponentById').mockRejectedValue(new Error('db hiccup'));
    try {
      const res = await cronPromote(cronReq());
      const body = (await res.json()) as {
        mediaSets: { promoted: Array<{ setId: string; componentKey: string | null }>; revalidated: string[] };
      };
      // Le bloc champs n'a rien à promouvoir : seul le lookup des ensembles échoue.
      expect(body.mediaSets.promoted).toEqual([expect.objectContaining({ setId: s.id, componentKey: null })]);
      expect(body.mediaSets.revalidated).toEqual(['components']);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET / — statut filtré en base et pagination des archivés', () => {
  it('archivés exclus par défaut ; `status=archived` paginé', async () => {
    for (const key of ['a', 'b', 'c'] as const) {
      await published({ variantKey: key, locale: 'fr' });
      await published({ variantKey: key, locale: 'fr', items: [{ mediaId: m2.id }] }); // archive la v1
    }
    const def = await listSets(req(BASE), keyCtx());
    const defBody = (await def.json()) as { sets: Array<{ status: string }>; page: unknown };
    expect(defBody.sets.map((s) => s.status)).toEqual(['published', 'published', 'published']);
    expect(defBody.page).toBeNull();

    const p1 = await listSets(req(`${BASE}?status=archived&limit=2`), keyCtx());
    const b1 = (await p1.json()) as { sets: Array<{ id: string; status: string }>; page: { hasMore: boolean } };
    expect(b1.sets).toHaveLength(2);
    expect(b1.sets.every((s) => s.status === 'archived')).toBe(true);
    expect(b1.page.hasMore).toBe(true);
    const p2 = await listSets(req(`${BASE}?status=archived&limit=2&offset=2`), keyCtx());
    const b2 = (await p2.json()) as { sets: Array<{ id: string }>; page: { hasMore: boolean } };
    expect(b2.sets).toHaveLength(1);
    expect(b2.page.hasMore).toBe(false);
    expect(new Set([...b1.sets, ...b2.sets].map((s) => s.id)).size).toBe(3);
  });
});

describe('L7 — invalidation ciblée côté médias', () => {
  const mediaCtx = (id: string) => ({ params: { id } });

  it('PATCH d’un média utilisé : `components` + tag des ensembles du composant concerné', async () => {
    await published({ items: [{ mediaId: m1.id }] });
    revalidateTagMock.mockClear();
    await patchMediaRoute(req(`http://x/api/admin/media/${m1.id}`, { method: 'PATCH', json: { alt: 'x' } }), mediaCtx(m1.id));
    expect(revalidatedTags().sort()).toEqual(['components', MEDIA_SETS_TAG].sort());
    revalidateTagMock.mockClear();
    // Média non utilisé : seul `components` (liaisons historiques).
    await patchMediaRoute(req(`http://x/api/admin/media/${m3.id}`, { method: 'PATCH', json: { alt: 'y' } }), mediaCtx(m3.id));
    expect(revalidatedTags()).toEqual(['components']);
  });

  it('DELETE simple d’un média utilisé : tag ciblé invalidé', async () => {
    await published({ items: [{ mediaId: m1.id }] });
    revalidateTagMock.mockClear();
    await deleteMediaRoute(req(`http://x/api/admin/media/${m1.id}`, { method: 'DELETE' }), mediaCtx(m1.id));
    expect(revalidatedTags()).toEqual(expect.arrayContaining(['components', MEDIA_SETS_TAG]));
  });

  it('regenerate n’invalide plus à l’enfilage ; media-optimize invalide après traitement', async () => {
    await published({ items: [{ mediaId: m2.id }] });
    revalidateTagMock.mockClear();
    const res = await regenerateMediaRoute(req(`http://x/api/admin/media/${m2.id}/regenerate`, { method: 'POST' }), mediaCtx(m2.id));
    expect(res.status).toBe(200);
    expect(revalidateTagMock).not.toHaveBeenCalled();

    const worker = await import('@/lib/media/worker/process-job');
    const spy = vi
      .spyOn(worker, 'runWorkerOnce')
      .mockResolvedValueOnce({ processed: 1, mediaIds: [m2.id] })
      .mockResolvedValueOnce({ processed: 0, mediaIds: [] });
    try {
      const cron = await mediaOptimizeCron(
        req('http://x/api/cron/media-optimize', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }),
      );
      expect(cron.status).toBe(200);
      expect(revalidatedTags().sort()).toEqual(['components', MEDIA_SETS_TAG].sort());
    } finally {
      spy.mockRestore();
    }
  });

  it('media-optimize sans job traité : aucune invalidation', async () => {
    const worker = await import('@/lib/media/worker/process-job');
    const spy = vi.spyOn(worker, 'runWorkerOnce').mockResolvedValue({ processed: 0, mediaIds: [] });
    try {
      const cron = await mediaOptimizeCron(
        req('http://x/api/cron/media-optimize', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }),
      );
      expect(cron.status).toBe(200);
      expect(revalidateTagMock).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
 * Revue PR 6 — préconditions `If-None-Match: *` et plan revu du bulk
 * ────────────────────────────────────────────────────────────────── */

describe('PUT /draft + POST /restore — If-None-Match: *', () => {
  const body = () => ({ slot: 'primary', variantDim: 'angle', variantKey: 'e', locale: 'ar', items: [{ mediaId: m2.id }] });

  it('201 sans brouillon existant ; 409 + brouillon courant s’il en existe un (non écrasé)', async () => {
    const created = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', headers: { 'if-none-match': '*' }, json: body() }),
      keyCtx(),
    );
    expect(created.status).toBe(201);
    const first = ((await created.json()) as { set: ComponentMediaSetWithItems }).set;

    const res = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', headers: { 'if-none-match': '*' }, json: { ...body(), items: [{ mediaId: m3.id }] } }),
      keyCtx(),
    );
    expect(res.status).toBe(409);
    const err = (await res.json()) as ErrorBody;
    expect(err.error.code).toBe('version_conflict');
    expect((err.error.details?.current as { id: string }).id).toBe(first.id);
    expect(new Date((await getSetById(first.id))!.updatedAt).toISOString()).toBe(first.updatedAt as unknown as string);
  });

  it('400 valeur autre que « * » ou combinée à If-Match', async () => {
    const bad = await putDraft(
      req(`${BASE}/draft`, { method: 'PUT', headers: { 'if-none-match': '"abc"' }, json: body() }),
      keyCtx(),
    );
    expect(bad.status).toBe(400);
    const both = await putDraft(
      req(`${BASE}/draft`, {
        method: 'PUT',
        headers: { 'if-none-match': '*', 'if-match': new Date().toISOString() },
        json: body(),
      }),
      keyCtx(),
    );
    expect(both.status).toBe(400);
  });

  it('restore : 409 si un brouillon est apparu, 200 sinon', async () => {
    const p = await published();
    const hist = await historyRoute(req(`${BASE}/history?slot=primary&variantDim=angle&variantKey=e&locale=ar`), keyCtx());
    const entry = ((await hist.json()) as { entries: Array<{ id: string; setId: string; action: string }> }).entries.find(
      (e) => e.setId === p.id && e.action === 'publish',
    )!;
    const ok = await restoreRoute(
      req(`${BASE}/restore`, { method: 'POST', headers: { 'if-none-match': '*' }, json: { historyId: entry.id } }),
      keyCtx(),
    );
    expect(ok.status).toBe(200);
    const again = await restoreRoute(
      req(`${BASE}/restore`, { method: 'POST', headers: { 'if-none-match': '*' }, json: { historyId: entry.id } }),
      keyCtx(),
    );
    expect(again.status).toBe(409);
  });
});

describe('POST /bulk-publish — plan revu (`expected`)', () => {
  type DryBody = { results: Array<{ setId: string; updatedAt: string }> };
  async function dry(): Promise<DryBody> {
    const res = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: { source: 'import' }, dryRun: true } }),
      keyCtx(),
    );
    return (await res.json()) as DryBody;
  }
  const run = (expected: Array<{ setId: string; updatedAt: string }>) =>
    bulkPublishRoute(
      req(`${BASE}/bulk-publish`, { method: 'POST', json: { filter: { source: 'import' }, expected } }),
      keyCtx(),
    );

  it('plan identique : publie', async () => {
    await draft({ variantKey: 'a', locale: 'fr', source: 'import' });
    const plan = await dry();
    expect(plan.results[0]?.updatedAt).toMatch(/Z$/);
    const res = await run(plan.results.map(({ setId, updatedAt }) => ({ setId, updatedAt })));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { published: number }).published).toBe(1);
  });

  it('nouveau brouillon importé ou brouillon modifié depuis l’essai : 409, rien n’est publié', async () => {
    const a = await draft({ variantKey: 'a', locale: 'fr', source: 'import' });
    const plan = (await dry()).results.map(({ setId, updatedAt }) => ({ setId, updatedAt }));
    const b = await draft({ variantKey: 'b', locale: 'fr', source: 'import' });
    const res = await run(plan);
    expect(res.status).toBe(409);
    const err = (await res.json()) as ErrorBody;
    expect(err.error.code).toBe('invalid_state');
    expect(err.error.details?.reason).toBe('bulk.plan_changed');
    expect((await getSetById(a.id))?.status).toBe('draft');
    expect((await getSetById(b.id))?.status).toBe('draft');

    const plan2 = (await dry()).results.map(({ setId, updatedAt }) => ({ setId, updatedAt }));
    await draft({ variantKey: 'a', locale: 'fr', source: 'import', items: [{ mediaId: m2.id }] });
    expect((await run(plan2)).status).toBe(409);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it('400 `expected` avec dryRun', async () => {
    const res = await bulkPublishRoute(
      req(`${BASE}/bulk-publish`, {
        method: 'POST',
        json: { filter: { source: 'import' }, dryRun: true, expected: [] },
      }),
      keyCtx(),
    );
    expect(res.status).toBe(400);
  });
});
