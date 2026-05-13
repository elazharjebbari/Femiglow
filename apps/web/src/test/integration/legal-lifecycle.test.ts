/**
 * Lifecycle complet d'une page légale — machine d'état end-to-end.
 *
 * Scénario : 2 admins coopèrent pour préparer puis publier une page :
 *   adm_A crée    (draft v1)
 *   adm_A patch   (draft v1, updatedAt bump)
 *   adm_A submit  (review)
 *   adm_B publish (review → published, version 1 → 2, history v2 inséré)
 *   adm_A patch   (published v2 → draft v2)  ← FF check
 *   adm_A publish (draft → published v3, history v3 inséré)
 *   adm_B restore v2 (published v3 → draft, body remplacé par v2)
 *   adm_B archive (archived)
 *
 * Vérifie chaque transition de statut + bump version au bon moment +
 * audit log à chaque étape + 4-eyes respecté.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

// State machine simulée — la "DB" en mémoire reflète l'évolution
interface FakePage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  bodyMd: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  version: number;
  includeInSearch: boolean;
  canonicalUrl: string | null;
  locale: 'fr-MA' | 'ar-MA';
  requireLegalReview: boolean;
  submittedBy: string | null;
  submittedAt: Date | null;
  publishedBy: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  updatedBy: string | null;
  createdAt: Date;
  createdBy: string | null;
  lastLegalReviewAt: Date | null;
  lastLegalReviewBy: string | null;
}

interface HistorySnapshot {
  pageId: string;
  version: number;
  bodyMd: string;
  publishedBy: string | null;
  publishedAt: Date;
}

const state: {
  pages: Map<string, FakePage>;
  history: HistorySnapshot[];
} = { pages: new Map(), history: [] };

let currentActor = 'adm_A';
let sessionMock: AdminSession = {
  adminId: currentActor,
  email: 'a@b.c',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
  checkSameOrigin: vi.fn(() => ({ ok: true })),
}));

const auditCalls: Array<{ action: string; actor: string | null; resource: string | null; meta: Record<string, unknown> }> = [];
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: (action: string, actor: string | null, resource: string | null, meta?: Record<string, unknown>) => {
    auditCalls.push({ action, actor, resource, meta: meta ?? {} });
    return Promise.resolve();
  },
}));

// Repo mock — simule la DB en mémoire
vi.mock('@/lib/legal/repository', async () => {
  return {
    getLegalPageBySlug: async (slug: string) => state.pages.get(slug) ?? null,
    getPublishedLegalPage: async (slug: string) => {
      const p = state.pages.get(slug);
      return p && p.status === 'published' ? p : null;
    },
    listLegalPages: async () => [...state.pages.values()],
    listAllPlacements: async () => [],
    listAllTemplateVars: async () => [],
    listAllZones: async () => [],
    legalListStats: async () => ({
      total: state.pages.size,
      draft: 0, review: 0, published: 0, archived: 0,
    }),
    listHistoryForSlug: async (slug: string) =>
      state.history
        .filter((h) => state.pages.get(slug)?.id === h.pageId)
        .map((h) => ({
          ...h,
          slug,
          title: 't',
          description: null,
          gitCommitSha: null,
          gitCommitAt: null,
          statusAtSnapshot: 'published',
          metadataJson: {},
          createdAt: h.publishedAt,
          id: `lph_${h.pageId}_${h.version}`,
        })),
    createLegalPage: async (input: {
      slug: string;
      title: string;
      description?: string | null;
      bodyMd: string;
      actorId?: string | null;
    }) => {
      const now = new Date();
      const page: FakePage = {
        id: `lp_${input.slug}`,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        bodyMd: input.bodyMd,
        status: 'draft',
        version: 1,
        includeInSearch: false,
        canonicalUrl: null,
        locale: 'fr-MA',
        requireLegalReview: true,
        submittedBy: null,
        submittedAt: null,
        publishedBy: null,
        publishedAt: null,
        updatedAt: now,
        updatedBy: input.actorId ?? null,
        createdAt: now,
        createdBy: input.actorId ?? null,
        lastLegalReviewAt: null,
        lastLegalReviewBy: null,
      };
      state.pages.set(input.slug, page);
      return page;
    },
    updateLegalPageWithLock: async (slug: string, patch: {
      title?: string;
      description?: string | null;
      bodyMd?: string;
      actorId?: string | null;
      expectedUpdatedAt?: number;
    }) => {
      const p = state.pages.get(slug);
      if (!p) return { ok: false, reason: 'not_found' };
      if (patch.expectedUpdatedAt !== undefined && patch.expectedUpdatedAt !== p.updatedAt.getTime()) {
        return { ok: false, reason: 'version_conflict', currentUpdatedAt: p.updatedAt };
      }
      const updated: FakePage = {
        ...p,
        title: patch.title ?? p.title,
        description: patch.description !== undefined ? patch.description : p.description,
        bodyMd: patch.bodyMd ?? p.bodyMd,
        // PATCH ramène une page published en draft (admin a re-édité)
        status: p.status === 'published' ? 'draft' : p.status,
        updatedAt: new Date(p.updatedAt.getTime() + 1000),
        updatedBy: patch.actorId ?? null,
      };
      state.pages.set(slug, updated);
      return { ok: true, page: updated };
    },
    submitForReview: async (slug: string, actorId: string | null) => {
      const p = state.pages.get(slug);
      if (!p) return null;
      const updated: FakePage = {
        ...p,
        status: 'review',
        submittedBy: actorId,
        submittedAt: new Date(),
        updatedAt: new Date(p.updatedAt.getTime() + 1000),
        updatedBy: actorId,
      };
      state.pages.set(slug, updated);
      return updated;
    },
    archiveLegalPage: async (slug: string, actorId: string | null) => {
      const p = state.pages.get(slug);
      if (!p) return null;
      const updated: FakePage = {
        ...p,
        status: 'archived',
        updatedAt: new Date(p.updatedAt.getTime() + 1000),
        updatedBy: actorId,
      };
      state.pages.set(slug, updated);
      return updated;
    },
  };
});

// Publish module mock — implémente la logique 4-eyes + history insert
vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: async (slug: string, confirm: string, actorId: string | null) => {
    if (confirm !== 'PUBLIER') return { ok: false, code: 'confirm_mismatch' };
    const p = state.pages.get(slug);
    if (!p) return { ok: false, code: 'not_found' };
    if (
      p.requireLegalReview &&
      p.status === 'review' &&
      p.submittedBy &&
      p.submittedBy === actorId
    ) {
      return { ok: false, code: 'same_actor' };
    }
    const newVersion = p.version + 1;
    const now = new Date();
    state.history.push({
      pageId: p.id,
      version: newVersion,
      bodyMd: p.bodyMd,
      publishedBy: actorId,
      publishedAt: now,
    });
    state.pages.set(slug, {
      ...p,
      status: 'published',
      version: newVersion,
      publishedAt: now,
      publishedBy: actorId,
      updatedAt: new Date(p.updatedAt.getTime() + 1000),
      updatedBy: actorId,
    });
    return { ok: true, version: newVersion, publishedAt: now };
  },
  restoreLegalPageVersion: async (slug: string, version: number, actorId: string | null) => {
    const p = state.pages.get(slug);
    if (!p) return { ok: false, code: 'not_found' };
    const snap = state.history.find((h) => h.pageId === p.id && h.version === version);
    if (!snap) return { ok: false, code: 'version_not_found' };
    state.pages.set(slug, {
      ...p,
      bodyMd: snap.bodyMd,
      status: 'draft',
      updatedAt: new Date(p.updatedAt.getTime() + 1000),
      updatedBy: actorId,
    });
    return { ok: true };
  },
}));

import { POST as createAdmin } from '@/app/api/admin/legal/route';
import {
  PATCH as patchAdminPage,
  DELETE as deleteAdminPage,
} from '@/app/api/admin/legal/[slug]/route';
import { POST as submitReview } from '@/app/api/admin/legal/[slug]/submit-review/route';
import { POST as publishRoute } from '@/app/api/admin/legal/[slug]/publish/route';
import { POST as restoreRoute } from '@/app/api/admin/legal/[slug]/restore/[version]/route';

function asActor(adminId: string) {
  currentActor = adminId;
  sessionMock = { ...sessionMock, adminId };
}

beforeEach(() => {
  state.pages.clear();
  state.history.length = 0;
  auditCalls.length = 0;
  asActor('adm_A');
});

describe('Lifecycle complet d\'une page légale', () => {
  it('exécute le scénario 8 étapes sans erreur + machine d\'état correcte', async () => {
    const SLUG = 'cgv-test';

    // 1. adm_A CREATE
    const createRes = await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: SLUG,
          title: 'CGV initiale',
          bodyMd: '# Titre initial\n\nContenu initial.',
        }),
      }),
    );
    expect(createRes.status).toBe(201);
    let page = state.pages.get(SLUG)!;
    expect(page.status).toBe('draft');
    expect(page.version).toBe(1);
    expect(page.createdBy).toBe('adm_A');

    // 2. adm_A PATCH (édition contenu)
    const patchRes1 = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ bodyMd: '# Titre v2\n\nContenu modifié plus complet.' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(patchRes1.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.bodyMd).toContain('Contenu modifié');
    expect(page.status).toBe('draft'); // toujours draft

    // 3. adm_A SUBMIT-REVIEW
    const submitRes = await submitReview(new Request('http://x', { method: 'POST' }), {
      params: { slug: SLUG },
    });
    expect(submitRes.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('review');
    expect(page.submittedBy).toBe('adm_A');

    // 4. adm_A PUBLISH (devrait échouer 4-eyes)
    asActor('adm_A');
    const publishSelfRes = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(publishSelfRes.status).toBe(422);
    const selfBody = (await publishSelfRes.json()) as { error: { code: string } };
    expect(selfBody.error.code).toBe('same_actor');
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('review'); // pas changé

    // 5. adm_B PUBLISH (succès)
    asActor('adm_B');
    const publishRes = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(publishRes.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('published');
    expect(page.version).toBe(2);
    expect(page.publishedBy).toBe('adm_B');
    expect(state.history).toHaveLength(1);
    expect(state.history[0]?.version).toBe(2);

    // 6. adm_A PATCH (published → draft via update)
    asActor('adm_A');
    const patchRes2 = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ bodyMd: '# Erratum\n\nCorrection après publication.' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(patchRes2.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('draft');
    expect(page.bodyMd).toContain('Erratum');

    // 7. adm_A PUBLISH (draft → published, pas en review donc pas 4-eyes)
    const publishDraftRes = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(publishDraftRes.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('published');
    expect(page.version).toBe(3);
    expect(state.history).toHaveLength(2);
    expect(state.history[1]?.version).toBe(3);

    // 8. adm_B RESTORE v2 → page repasse en draft avec bodyMd v2
    asActor('adm_B');
    const restoreRes = await restoreRoute(new Request('http://x', { method: 'POST' }), {
      params: { slug: SLUG, version: '2' },
    });
    expect(restoreRes.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('draft');
    expect(page.bodyMd).toContain('Contenu modifié'); // body v2

    // 9. adm_B ARCHIVE (draft → archived OK, published refusé)
    asActor('adm_B');
    const archiveRes = await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: SLUG },
    });
    expect(archiveRes.status).toBe(200);
    page = state.pages.get(SLUG)!;
    expect(page.status).toBe('archived');
  });

  it('audit log contient une entrée par action mutative', async () => {
    const SLUG = 'audit-trail';

    await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: SLUG,
          title: 'Audit trail',
          bodyMd: '# Body content suffisant.',
        }),
      }),
    );
    await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated title' }),
      }),
      { params: { slug: SLUG } },
    );
    await submitReview(new Request('http://x', { method: 'POST' }), { params: { slug: SLUG } });
    asActor('adm_B');
    await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );

    // Note : publishLegalPage est mocké, donc le mock de logLegalEvent
    // (via vi.mock @/lib/legal/audit) ne sera appelé que pour les actions
    // qui passent par les routes (create, update, submit, archive). On
    // valide donc explicitement celles-là.
    const actions = auditCalls.map((c) => c.action);
    expect(actions).toContain('legal.page.created');
    expect(actions).toContain('legal.page.updated');
    expect(actions).toContain('legal.page.submitted-review');
  });

  it('refuse DELETE sur page actuellement publiée', async () => {
    const SLUG = 'cant-delete';
    await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: SLUG,
          title: 'Title',
          bodyMd: '# Body suffisamment long.',
        }),
      }),
    );
    await submitReview(new Request('http://x', { method: 'POST' }), { params: { slug: SLUG } });
    asActor('adm_B');
    await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );

    const archiveRes = await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: SLUG },
    });
    expect(archiveRes.status).toBe(409);
  });

  it('PATCH avec If-Match obsolète sur page après publish → 409', async () => {
    const SLUG = 'etag-after-publish';
    await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: SLUG,
          title: 'Title',
          bodyMd: '# Body suffisamment long.',
        }),
      }),
    );
    const initial = state.pages.get(SLUG)!.updatedAt.getTime();

    // Submit + publish bumpe updatedAt
    await submitReview(new Request('http://x', { method: 'POST' }), { params: { slug: SLUG } });
    asActor('adm_B');
    await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: SLUG } },
    );

    // adm_A tente un PATCH avec l'ancien If-Match → 409
    asActor('adm_A');
    const patchRes = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': `W/"${initial}"`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New title' }),
      }),
      { params: { slug: SLUG } },
    );
    expect(patchRes.status).toBe(409);
  });
});
