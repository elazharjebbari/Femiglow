/**
 * Suite intégration — Routes admin legal.
 *
 * Couvre :
 *  - 401 sans session sur chaque endpoint.
 *  - GET /api/admin/legal : liste + stats + missing_vars enrichis.
 *  - POST /api/admin/legal : 201 create, 409 slug conflict, 422 invalide.
 *  - GET /api/admin/legal/[slug] : 200 + placements + missing_vars.
 *  - PATCH /api/admin/legal/[slug] : update + audit.
 *  - DELETE /api/admin/legal/[slug] : 409 si published, 200 sinon, audit.
 *  - POST /api/admin/legal/[slug]/submit-review : 200.
 *  - POST /api/admin/legal/[slug]/publish : 200 succès, 400 confirm
 *    mismatch, 422 vars manquantes.
 *  - GET /api/admin/legal/[slug]/history : 200 + excerpt 500 chars.
 *  - POST /api/admin/legal/[slug]/restore/[version] : 200 + draft restored.
 *  - GET/PUT /api/admin/legal/placements.
 *  - GET/PUT /api/admin/legal/template-vars (mask sensitive).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

const auditMock = vi.fn();
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: (...args: unknown[]) => {
    auditMock(...args);
    return Promise.resolve();
  },
}));

vi.mock('@/lib/legal/repository', () => ({
  legalListStats: vi.fn(),
  listLegalPages: vi.fn(),
  listAllTemplateVars: vi.fn(),
  listAllPlacements: vi.fn(),
  listAllZones: vi.fn(),
  listPlacementsForZone: vi.fn(),
  listPublishedSlugs: vi.fn(),
  listPublishedSearchablePages: vi.fn(),
  getLegalPageBySlug: vi.fn(),
  getPublishedLegalPage: vi.fn(),
  createLegalPage: vi.fn(),
  updateLegalPage: vi.fn(),
  updateLegalPageWithLock: vi.fn(),
  archiveLegalPage: vi.fn(),
  submitForReview: vi.fn(),
  listHistoryForSlug: vi.fn(),
  updateTemplateVar: vi.fn(),
  upsertPlacement: vi.fn(),
  pagesWithMissingPlacements: vi.fn(),
}));

vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: vi.fn(),
  restoreLegalPageVersion: vi.fn(),
}));

import * as repo from '@/lib/legal/repository';
import * as publishMod from '@/lib/legal/publish';

import { GET as listAdmin, POST as createAdmin } from '@/app/api/admin/legal/route';
import {
  GET as getAdminPage,
  PATCH as patchAdminPage,
  DELETE as deleteAdminPage,
} from '@/app/api/admin/legal/[slug]/route';
import { POST as submitReview } from '@/app/api/admin/legal/[slug]/submit-review/route';
import { POST as publishRoute } from '@/app/api/admin/legal/[slug]/publish/route';
import { GET as historyRoute } from '@/app/api/admin/legal/[slug]/history/route';
import { POST as restoreRoute } from '@/app/api/admin/legal/[slug]/restore/[version]/route';
import {
  GET as placementsGet,
  PUT as placementsPut,
} from '@/app/api/admin/legal/placements/route';
import {
  GET as varsGet,
  PUT as varsPut,
} from '@/app/api/admin/legal/template-vars/route';

beforeEach(() => {
  sessionMock = {
    adminId: 'adm_1',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  };
  auditMock.mockClear();
  revalidatePathMock.mockClear();
  revalidateTagMock.mockClear();
  for (const fn of Object.values(repo)) {
    if (typeof fn === 'function') (vi.mocked(fn) as ReturnType<typeof vi.fn>).mockReset();
  }
  for (const fn of Object.values(publishMod)) {
    if (typeof fn === 'function') (vi.mocked(fn) as ReturnType<typeof vi.fn>).mockReset();
  }
});

afterEach(() => vi.clearAllMocks());

const PAGE_BASE = {
  id: 'lp_x',
  slug: 'cgv',
  title: 'CGV',
  description: 'Conditions',
  bodyMd: '# CGV\n\nRC : {{COMPANY_RC}}',
  status: 'draft' as const,
  version: 1,
  includeInSearch: false,
  canonicalUrl: null,
  locale: 'fr-MA' as const,
  requireLegalReview: true,
  lastLegalReviewAt: null,
  lastLegalReviewBy: null,
  submittedAt: null,
  submittedBy: null,
  publishedAt: null,
  publishedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
};

describe('Auth — 401 sans session', () => {
  it('GET /api/admin/legal rejette sans session', async () => {
    sessionMock = null;
    const res = await listAdmin(new Request('http://x/api/admin/legal'));
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/legal rejette sans session', async () => {
    sessionMock = null;
    const res = await createAdmin(
      new Request('http://x/api/admin/legal', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/legal/[slug] rejette sans session', async () => {
    sessionMock = null;
    const res = await getAdminPage(new Request('http://x'), { params: { slug: 'cgv' } });
    expect(res.status).toBe(401);
  });

  it('POST /publish rejette sans session', async () => {
    sessionMock = null;
    const res = await publishRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ confirm: 'PUBLIER' }) }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/legal — list + stats', () => {
  it('200 avec pages enrichies + stats + missing_vars', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([PAGE_BASE] as never);
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 1,
      draft: 1,
      review: 0,
      published: 0,
      archived: 0,
    });
    vi.mocked(repo.listAllTemplateVars).mockResolvedValue([
      { key: 'COMPANY_RC', value: '', isRequired: true } as never,
    ]);

    const res = await listAdmin(new Request('http://x/api/admin/legal'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      pages: Array<{ slug: string; missing_vars: string[] }>;
      stats: { total: number };
    };
    expect(body.stats.total).toBe(1);
    expect(body.pages[0]?.slug).toBe('cgv');
    expect(body.pages[0]?.missing_vars).toEqual(['COMPANY_RC']);
  });

  it('filtre status=draft via query string', async () => {
    vi.mocked(repo.listLegalPages).mockResolvedValue([]);
    vi.mocked(repo.legalListStats).mockResolvedValue({
      total: 0, draft: 0, review: 0, published: 0, archived: 0,
    });
    vi.mocked(repo.listAllTemplateVars).mockResolvedValue([]);
    await listAdmin(new Request('http://x/api/admin/legal?status=draft'));
    expect(vi.mocked(repo.listLegalPages)).toHaveBeenCalledWith({ status: 'draft' });
  });
});

describe('POST /api/admin/legal — create', () => {
  it('201 create + audit', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(null);
    vi.mocked(repo.createLegalPage).mockResolvedValue(PAGE_BASE as never);

    const res = await createAdmin(
      new Request('http://x/api/admin/legal', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'cgv',
          title: 'CGV',
          bodyMd: '# Hello there',
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.created',
      'adm_1',
      'lp_x',
      expect.objectContaining({ slug: 'cgv' }),
    );
  });

  it('409 si slug existe déjà', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(PAGE_BASE as never);

    const res = await createAdmin(
      new Request('http://x/api/admin/legal', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'cgv',
          title: 'CGV',
          bodyMd: '# CGV body content',
        }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it('422 si payload invalide (slug avec majuscule)', async () => {
    const res = await createAdmin(
      new Request('http://x/api/admin/legal', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'CGV-INVALID',
          title: 'X',
          bodyMd: 'short body content',
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('400 si JSON invalide', async () => {
    const res = await createAdmin(
      new Request('http://x/api/admin/legal', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET/PATCH/DELETE /api/admin/legal/[slug]', () => {
  it('GET 200 + placements + missing_vars', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(PAGE_BASE as never);
    vi.mocked(repo.listAllPlacements).mockResolvedValue([
      { pageSlug: 'cgv', zoneKey: 'footer-main' } as never,
      { pageSlug: 'other', zoneKey: 'footer-main' } as never,
    ]);
    vi.mocked(repo.listAllTemplateVars).mockResolvedValue([
      { key: 'COMPANY_RC', value: null, isRequired: true } as never,
    ]);

    const res = await getAdminPage(new Request('http://x'), { params: { slug: 'cgv' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      placements: Array<{ pageSlug: string }>;
      missing_vars: string[];
    };
    expect(body.placements).toHaveLength(1);
    expect(body.placements[0]?.pageSlug).toBe('cgv');
    expect(body.missing_vars).toEqual(['COMPANY_RC']);
  });

  it('GET 404 si slug inconnu', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(null);
    const res = await getAdminPage(new Request('http://x'), { params: { slug: 'x' } });
    expect(res.status).toBe(404);
  });

  it('PATCH update + audit', async () => {
    const updated = { ...PAGE_BASE, title: 'CGV v2' };
    vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
      ok: true,
      page: updated as never,
    });
    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'CGV v2' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toMatch(/^W\/"\d+"$/);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.updated',
      'adm_1',
      'lp_x',
      expect.objectContaining({ slug: 'cgv', fields: ['title'] }),
    );
  });

  it('PATCH 422 sur description trop longue', async () => {
    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ description: 'x'.repeat(300) }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(422);
  });

  it('GET expose le header ETag (W/"<updatedAt-ms>")', async () => {
    const fixedDate = new Date('2026-05-13T12:00:00Z');
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue({
      ...PAGE_BASE,
      updatedAt: fixedDate,
    } as never);
    vi.mocked(repo.listAllPlacements).mockResolvedValue([]);
    vi.mocked(repo.listAllTemplateVars).mockResolvedValue([]);

    const res = await getAdminPage(new Request('http://x'), { params: { slug: 'cgv' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe(`W/"${fixedDate.getTime()}"`);
  });

  it('PATCH 409 version_conflict si If-Match obsolète', async () => {
    const current = new Date('2026-05-13T12:00:05Z');
    vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
      ok: false,
      reason: 'version_conflict',
      currentUpdatedAt: current,
    });

    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: {
          'If-Match': `W/"${current.getTime() - 60_000}"`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'Title OK' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(409);
    expect(res.headers.get('etag')).toBe(`W/"${current.getTime()}"`);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('version_conflict');
    // audit pas appelé sur conflict
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('PATCH 200 si If-Match matche', async () => {
    const ts = new Date('2026-05-13T12:00:00Z');
    vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
      ok: true,
      page: { ...PAGE_BASE, updatedAt: new Date(ts.getTime() + 1000) } as never,
    });

    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': `W/"${ts.getTime()}"`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Title OK' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(200);
    // Le repo doit avoir reçu expectedUpdatedAt
    expect(vi.mocked(repo.updateLegalPageWithLock)).toHaveBeenCalledWith(
      'cgv',
      expect.objectContaining({ expectedUpdatedAt: ts.getTime() }),
    );
  });

  it('PATCH 200 sans If-Match (back-compat, pas de lock)', async () => {
    vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
      ok: true,
      page: PAGE_BASE as never,
    });
    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Title OK' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(repo.updateLegalPageWithLock)).toHaveBeenCalledWith(
      'cgv',
      expect.objectContaining({ expectedUpdatedAt: undefined }),
    );
  });

  it('DELETE 409 si status=published', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue({
      ...PAGE_BASE,
      status: 'published',
    } as never);
    const res = await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(409);
  });

  it('DELETE 200 + audit si status=draft', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(PAGE_BASE as never);
    vi.mocked(repo.archiveLegalPage).mockResolvedValue({
      ...PAGE_BASE,
      status: 'archived',
    } as never);
    const res = await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.archived',
      'adm_1',
      'lp_x',
      expect.objectContaining({ slug: 'cgv' }),
    );
  });
});

describe('POST /api/admin/legal/[slug]/submit-review', () => {
  it('200 + audit + status review', async () => {
    vi.mocked(repo.submitForReview).mockResolvedValue({
      ...PAGE_BASE,
      status: 'review',
      submittedAt: new Date(),
    } as never);

    const res = await submitReview(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.submitted-review',
      'adm_1',
      'lp_x',
      expect.anything(),
    );
  });

  it('404 si page inexistante', async () => {
    vi.mocked(repo.submitForReview).mockResolvedValue(null);
    const res = await submitReview(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'x' },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/legal/[slug]/publish', () => {
  it('200 succès + revalidatePath + body version/publishedAt', async () => {
    vi.mocked(publishMod.publishLegalPage).mockResolvedValue({
      ok: true,
      version: 4,
      publishedAt: new Date('2026-05-13T00:00:00Z'),
    });
    const res = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; status: string };
    expect(body.status).toBe('published');
    expect(body.version).toBe(4);
    expect(revalidatePathMock).toHaveBeenCalledWith('/legal/cgv');
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-page:cgv');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-pages-published');
  });

  it('400 si confirm != PUBLIER', async () => {
    const res = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'go' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(400);
  });

  it('422 si variables required manquantes', async () => {
    vi.mocked(publishMod.publishLegalPage).mockResolvedValue({
      ok: false,
      code: 'missing_required_vars',
      missing: ['COMPANY_RC', 'ICE'],
    });
    const res = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { missing: string[] };
    expect(body.missing).toEqual(['COMPANY_RC', 'ICE']);
  });

  it('404 si page introuvable', async () => {
    vi.mocked(publishMod.publishLegalPage).mockResolvedValue({
      ok: false,
      code: 'not_found',
    });
    const res = await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: 'fantome' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/legal/[slug]/history', () => {
  it('200 avec entries + excerpt (≤ 500 chars)', async () => {
    vi.mocked(repo.listHistoryForSlug).mockResolvedValue([
      {
        id: 'lph_1',
        version: 2,
        publishedAt: new Date('2026-05-01T00:00:00Z'),
        publishedBy: 'adm_1',
        title: 'CGV v2',
        bodyMd: 'x'.repeat(600),
        gitCommitSha: null,
      } as never,
    ]);
    const res = await historyRoute(new Request('http://x'), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ body_md_excerpt: string }>;
    expect(body[0]?.body_md_excerpt).toHaveLength(500);
  });
});

describe('POST /api/admin/legal/[slug]/restore/[version]', () => {
  it('200 succès + audit (via restoreLegalPageVersion)', async () => {
    vi.mocked(publishMod.restoreLegalPageVersion).mockResolvedValue({ ok: true });
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue({
      ...PAGE_BASE,
      status: 'draft',
    } as never);

    const res = await restoreRoute(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'cgv', version: '2' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { restored_from: number; status: string };
    expect(body.restored_from).toBe(2);
    expect(body.status).toBe('draft');
  });

  it('400 si version non-numérique', async () => {
    const res = await restoreRoute(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'cgv', version: 'abc' },
    });
    expect(res.status).toBe(400);
  });

  it('404 si version inconnue', async () => {
    vi.mocked(publishMod.restoreLegalPageVersion).mockResolvedValue({
      ok: false,
      code: 'version_not_found',
    });
    const res = await restoreRoute(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'cgv', version: '99' },
    });
    expect(res.status).toBe(404);
  });
});

describe('Placements + Template-vars', () => {
  it('GET /placements retourne matrix + zones', async () => {
    vi.mocked(repo.listAllZones).mockResolvedValue([
      { key: 'footer-main', label: 'Footer', description: null, maxItemsRecommended: 8, isRequired: true, displayOrder: 1, createdAt: new Date() } as never,
    ]);
    vi.mocked(repo.listAllPlacements).mockResolvedValue([
      { pageSlug: 'cgv', zoneKey: 'footer-main', displayOrder: 1, isVisible: true, labelOverride: null, createdAt: new Date(), updatedAt: new Date() } as never,
    ]);

    const res = await placementsGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { zones: unknown[]; matrix: unknown[] };
    expect(body.zones).toHaveLength(1);
    expect(body.matrix).toHaveLength(1);
  });

  it('PUT /placements upsert + audit + revalidate', async () => {
    vi.mocked(repo.upsertPlacement).mockResolvedValue();
    const res = await placementsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({
          pageSlug: 'cgv',
          zoneKey: 'footer-main',
          isVisible: true,
          displayOrder: 2,
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.placement.upserted',
      'adm_1',
      'cgv',
      expect.objectContaining({ zone_key: 'footer-main' }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/legal/cgv');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-zone:footer-main');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-page:cgv');
  });

  it('GET /template-vars masque les sensitive', async () => {
    vi.mocked(repo.listAllTemplateVars).mockResolvedValue([
      { key: 'API_KEY', value: 'sk-secretvalue123', label: 'key', description: null, isRequired: true, sensitive: true, updatedAt: new Date(), updatedBy: null } as never,
      { key: 'COMPANY_RC', value: '12345', label: 'RC', description: null, isRequired: true, sensitive: false, updatedAt: new Date(), updatedBy: null } as never,
    ]);
    const res = await varsGet();
    const body = (await res.json()) as Array<{ key: string; value: string | null }>;
    const api = body.find((v) => v.key === 'API_KEY');
    const rc = body.find((v) => v.key === 'COMPANY_RC');
    expect(api?.value).not.toBe('sk-secretvalue123');
    expect(api?.value).toMatch(/sk\*+.*/);
    expect(rc?.value).toBe('12345');
  });

  it('PUT /template-vars update + audit + revalidate sitemap', async () => {
    vi.mocked(repo.updateTemplateVar).mockResolvedValue({
      key: 'COMPANY_RC',
      value: '99999',
    } as never);
    const res = await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'COMPANY_RC', value: '99999' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.template-var.updated',
      'adm_1',
      'COMPANY_RC',
      expect.objectContaining({ had_value: true }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/sitemap.xml');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-template-vars');
    expect(revalidateTagMock).toHaveBeenCalledWith('legal-pages-published');
  });

  it('PUT /template-vars 404 si clé inconnue', async () => {
    vi.mocked(repo.updateTemplateVar).mockResolvedValue(null);
    const res = await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'INCONNUE', value: 'x' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('PUT /template-vars 422 si key invalide (minuscule)', async () => {
    const res = await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'invalidKey', value: 'x' }),
      }),
    );
    expect(res.status).toBe(422);
  });
});
