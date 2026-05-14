/**
 * Audit log deep — pour chaque action legal mutative, vérifie EXACTEMENT
 * le shape du meta payload :
 *  - action exact
 *  - actorId exact
 *  - resourceId exact (page id ou key)
 *  - meta keys présentes
 *  - meta keys non-leakées (pas de bodyMd entier loggué, pas de password)
 *
 * Sert de contrat : si quelqu'un modifie un audit call, ce test cassera
 * sciemment et forcera une revue du payload.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_audit',
  email: 'audit@test.ma',
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

const auditCalls: Array<{
  action: string;
  actorId: string | null;
  resourceId: string | null;
  meta: Record<string, unknown>;
}> = [];
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: (
    action: string,
    actorId: string | null,
    resourceId: string | null,
    meta?: Record<string, unknown>,
  ) => {
    auditCalls.push({ action, actorId, resourceId, meta: meta ?? {} });
    return Promise.resolve();
  },
}));

vi.mock('@/lib/legal/repository', () => ({
  getLegalPageBySlug: vi.fn(),
  createLegalPage: vi.fn(),
  updateLegalPageWithLock: vi.fn(),
  archiveLegalPage: vi.fn(),
  submitForReview: vi.fn(),
  listAllPlacements: vi.fn().mockResolvedValue([]),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
  upsertPlacement: vi.fn(),
  updateTemplateVar: vi.fn(),
}));

import * as repo from '@/lib/legal/repository';
import { POST as createAdmin } from '@/app/api/admin/legal/route';
import {
  PATCH as patchAdminPage,
  DELETE as deleteAdminPage,
} from '@/app/api/admin/legal/[slug]/route';
import { POST as submitReview } from '@/app/api/admin/legal/[slug]/submit-review/route';
import { PUT as placementsPut } from '@/app/api/admin/legal/placements/route';
import { PUT as varsPut } from '@/app/api/admin/legal/template-vars/route';

const PAGE = {
  id: 'lp_audit',
  slug: 'cgv',
  title: 'CGV',
  description: null,
  bodyMd: '# body',
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

beforeEach(() => {
  auditCalls.length = 0;
  vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(PAGE as never);
  vi.mocked(repo.createLegalPage).mockResolvedValue(PAGE as never);
  vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
    ok: true,
    page: PAGE as never,
  });
  vi.mocked(repo.archiveLegalPage).mockResolvedValue(PAGE as never);
  vi.mocked(repo.submitForReview).mockResolvedValue(PAGE as never);
  vi.mocked(repo.upsertPlacement).mockResolvedValue();
  vi.mocked(repo.updateTemplateVar).mockResolvedValue({
    key: 'COMPANY_RC',
    value: '99999',
  } as never);
});

describe('Audit — legal.page.created', () => {
  beforeEach(() => {
    // Pour CREATE, le slug ne doit pas déjà exister.
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue(null);
  });

  it('action, actorId, resourceId (page.id), meta.slug', async () => {
    await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'cgv',
          title: 'CGV',
          bodyMd: '# Hello body content suffisant',
        }),
      }),
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toEqual({
      action: 'legal.page.created',
      actorId: 'adm_audit',
      resourceId: 'lp_audit',
      meta: { slug: 'cgv' },
    });
  });

  it('meta NE contient PAS bodyMd entier (pas de leak)', async () => {
    await createAdmin(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'cgv',
          title: 'CGV',
          bodyMd: '# Contenu très long avec données potentiellement sensibles',
        }),
      }),
    );
    const meta = auditCalls[0]!.meta;
    expect(JSON.stringify(meta).length).toBeLessThan(200);
    expect(JSON.stringify(meta)).not.toContain('Contenu très long');
  });
});

describe('Audit — legal.page.updated', () => {
  it('liste les fields modifiés (fields[])', async () => {
    await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New title', includeInSearch: true }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(auditCalls).toHaveLength(1);
    const log = auditCalls[0]!;
    expect(log.action).toBe('legal.page.updated');
    expect(log.meta).toEqual({
      slug: 'cgv',
      fields: expect.arrayContaining(['title', 'includeInSearch']),
    });
    expect((log.meta.fields as string[])).toHaveLength(2);
  });

  it('audit pas appelé si validation échoue (422)', async () => {
    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'x' }), // < min 3
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(422);
    expect(auditCalls).toHaveLength(0);
  });

  it('audit pas appelé si version_conflict (409)', async () => {
    vi.mocked(repo.updateLegalPageWithLock).mockResolvedValue({
      ok: false,
      reason: 'version_conflict',
      currentUpdatedAt: new Date(),
    });
    const res = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': 'W/"1"', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res.status).toBe(409);
    expect(auditCalls).toHaveLength(0);
  });
});

describe('Audit — legal.page.archived', () => {
  it('action correcte sur DELETE', async () => {
    await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: 'cgv' },
    });
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]!.action).toBe('legal.page.archived');
    expect(auditCalls[0]!.meta).toEqual({ slug: 'cgv' });
  });

  it('pas d\'audit si page published (409)', async () => {
    vi.mocked(repo.getLegalPageBySlug).mockResolvedValue({
      ...PAGE,
      status: 'published',
    } as never);
    const res = await deleteAdminPage(new Request('http://x', { method: 'DELETE' }), {
      params: { slug: 'cgv' },
    });
    expect(res.status).toBe(409);
    expect(auditCalls).toHaveLength(0);
  });
});

describe('Audit — legal.page.submitted-review', () => {
  it('action et meta corrects', async () => {
    await submitReview(new Request('http://x', { method: 'POST' }), {
      params: { slug: 'cgv' },
    });
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: 'legal.page.submitted-review',
      actorId: 'adm_audit',
      resourceId: 'lp_audit',
      meta: { slug: 'cgv' },
    });
  });
});

describe('Audit — legal.placement.upserted', () => {
  it('zone_key + display_order + is_visible dans meta', async () => {
    await placementsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({
          pageSlug: 'cgv',
          zoneKey: 'footer-main',
          isVisible: true,
          displayOrder: 5,
        }),
      }),
    );
    expect(auditCalls).toHaveLength(1);
    const log = auditCalls[0]!;
    expect(log.action).toBe('legal.placement.upserted');
    expect(log.resourceId).toBe('cgv');
    expect(log.meta).toEqual({
      zone_key: 'footer-main',
      is_visible: true,
      display_order: 5,
    });
  });
});

describe('Audit — legal.template-var.updated', () => {
  it('flag had_value (true si value non-vide) sans LEAK de la value', async () => {
    await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'COMPANY_RC', value: 'SECRET-RC-12345' }),
      }),
    );
    expect(auditCalls).toHaveLength(1);
    const log = auditCalls[0]!;
    expect(log.action).toBe('legal.template-var.updated');
    expect(log.resourceId).toBe('COMPANY_RC');
    expect(log.meta).toEqual({
      key: 'COMPANY_RC',
      had_value: true,
    });
    // CRUCIAL : la value ne fuite PAS
    expect(JSON.stringify(log.meta)).not.toContain('SECRET-RC');
  });

  it('had_value = false si value vide', async () => {
    await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'COMPANY_RC', value: '' }),
      }),
    );
    expect(auditCalls[0]!.meta).toEqual({ key: 'COMPANY_RC', had_value: false });
  });

  it('had_value = false si value null', async () => {
    await varsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({ key: 'COMPANY_RC', value: null }),
      }),
    );
    expect(auditCalls[0]!.meta).toEqual({ key: 'COMPANY_RC', had_value: false });
  });
});

describe('Audit — invariants globaux', () => {
  it('actorId est toujours = session.adminId (jamais fallback "system")', async () => {
    // Patch reuse PAGE existing → utiliser le slug du fixture
    await Promise.all([
      patchAdminPage(
        new Request('http://x', {
          method: 'PATCH',
          body: JSON.stringify({ title: 'X long enough' }),
        }),
        { params: { slug: 'cgv' } },
      ),
      placementsPut(
        new Request('http://x', {
          method: 'PUT',
          body: JSON.stringify({
            pageSlug: 'cgv',
            zoneKey: 'footer-main',
            isVisible: true,
          }),
        }),
      ),
    ]);
    for (const call of auditCalls) {
      expect(call.actorId).toBe('adm_audit');
    }
  });

  it('toutes les actions ont un meta non-vide (pas d\'audit sans contexte)', async () => {
    await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Title valid' }),
      }),
      { params: { slug: 'cgv' } },
    );
    for (const call of auditCalls) {
      expect(Object.keys(call.meta).length).toBeGreaterThan(0);
    }
  });

  it('meta toujours sérialisable JSON', async () => {
    await placementsPut(
      new Request('http://x', {
        method: 'PUT',
        body: JSON.stringify({
          pageSlug: 'cgv',
          zoneKey: 'footer-main',
          isVisible: false,
        }),
      }),
    );
    for (const call of auditCalls) {
      // Doit pouvoir round-tripper JSON sans throw
      expect(() => JSON.parse(JSON.stringify(call.meta))).not.toThrow();
    }
  });
});
