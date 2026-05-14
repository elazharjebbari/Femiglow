/**
 * Suite intégration — CSRF / Origin check sur routes admin legal.
 *
 * On ne mocke pas `@/lib/legal/csrf` ici : on teste l'effet end-to-end
 * (403 quand Origin manque ou mismatch, 200 quand Origin matche
 * NEXT_PUBLIC_SITE_URL).
 *
 * Routes couvertes : POST /api/admin/legal, PATCH /api/admin/legal/[slug],
 * DELETE /api/admin/legal/[slug], POST /publish, POST /submit-review,
 * POST /restore/[v], PUT /placements, PUT /template-vars, POST
 * /health/recheck.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_csrf',
  email: 'csrf@test.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/legal/repository', () => ({
  getLegalPageBySlug: vi.fn().mockResolvedValue({
    id: 'lp_x',
    slug: 'cgv',
    status: 'draft',
    version: 1,
    title: 'CGV',
    bodyMd: '# CGV',
    description: null,
    updatedAt: new Date(),
    publishedAt: null,
  }),
  updateLegalPageWithLock: vi.fn().mockResolvedValue({
    ok: true,
    page: { slug: 'cgv', updatedAt: new Date() },
  }),
  createLegalPage: vi.fn().mockResolvedValue({ id: 'lp_x', slug: 'cgv' }),
  archiveLegalPage: vi.fn().mockResolvedValue({ id: 'lp_x', slug: 'cgv' }),
  submitForReview: vi.fn().mockResolvedValue({ id: 'lp_x', slug: 'cgv', submittedAt: new Date() }),
  upsertPlacement: vi.fn().mockResolvedValue(undefined),
  updateTemplateVar: vi.fn().mockResolvedValue({ key: 'COMPANY_RC', value: '1' }),
  listAllPlacements: vi.fn().mockResolvedValue([]),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
  listAllZones: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: vi.fn().mockResolvedValue({ ok: true, version: 2, publishedAt: new Date() }),
  restoreLegalPageVersion: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/legal/link-verifier', () => ({
  gatherPlacementsToCheck: vi.fn().mockResolvedValue([]),
  classifyLink: vi.fn(),
  checkLinkOverHttp: vi.fn(),
  recordSnapshots: vi.fn(),
}));

import { POST as createAdmin } from '@/app/api/admin/legal/route';
import {
  DELETE as deleteAdminPage,
  PATCH as patchAdminPage,
} from '@/app/api/admin/legal/[slug]/route';
import { POST as submitReview } from '@/app/api/admin/legal/[slug]/submit-review/route';
import { POST as publishRoute } from '@/app/api/admin/legal/[slug]/publish/route';
import { POST as restoreRoute } from '@/app/api/admin/legal/[slug]/restore/[version]/route';
import { PUT as placementsPut } from '@/app/api/admin/legal/placements/route';
import { PUT as varsPut } from '@/app/api/admin/legal/template-vars/route';
import { POST as recheckRoute } from '@/app/api/admin/legal/health/recheck/route';

import { resetMemoryStore } from '@/lib/db/client';

beforeEach(() => {
  resetMemoryStore();
});

interface MutationCase {
  name: string;
  call: (headers: Record<string, string>) => Promise<Response>;
}

const cases: MutationCase[] = [
  {
    name: 'POST /api/admin/legal',
    call: (headers) =>
      createAdmin(
        new Request('http://x', {
          method: 'POST',
          headers,
          body: JSON.stringify({ slug: 'new-page', title: 'New', bodyMd: '# Hello world body' }),
        }),
      ),
  },
  {
    name: 'PATCH /api/admin/legal/[slug]',
    call: (headers) =>
      patchAdminPage(
        new Request('http://x', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ title: 'Updated title' }),
        }),
        { params: { slug: 'cgv' } },
      ),
  },
  {
    name: 'DELETE /api/admin/legal/[slug]',
    call: (headers) =>
      deleteAdminPage(new Request('http://x', { method: 'DELETE', headers }), {
        params: { slug: 'cgv' },
      }),
  },
  {
    name: 'POST /submit-review',
    call: (headers) =>
      submitReview(new Request('http://x', { method: 'POST', headers }), {
        params: { slug: 'cgv' },
      }),
  },
  {
    name: 'POST /publish',
    call: (headers) =>
      publishRoute(
        new Request('http://x', {
          method: 'POST',
          headers,
          body: JSON.stringify({ confirm: 'PUBLIER' }),
        }),
        { params: { slug: 'cgv' } },
      ),
  },
  {
    name: 'POST /restore/[v]',
    call: (headers) =>
      restoreRoute(new Request('http://x', { method: 'POST', headers }), {
        params: { slug: 'cgv', version: '1' },
      }),
  },
  {
    name: 'PUT /placements',
    call: (headers) =>
      placementsPut(
        new Request('http://x', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ pageSlug: 'cgv', zoneKey: 'footer-main' }),
        }),
      ),
  },
  {
    name: 'PUT /template-vars',
    call: (headers) =>
      varsPut(
        new Request('http://x', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ key: 'COMPANY_RC', value: '1' }),
        }),
      ),
  },
  {
    name: 'POST /health/recheck',
    call: (headers) =>
      recheckRoute(new Request('http://x', { method: 'POST', headers })),
  },
];

describe('CSRF — mutations admin sans Origin matchant', () => {
  for (const c of cases) {
    it(`${c.name} → 403 sans Origin/Referer`, async () => {
      const res = await c.call({});
      expect(res.status).toBe(403);
    });

    it(`${c.name} → 403 avec Origin étranger`, async () => {
      const res = await c.call({ origin: 'https://evil.tld' });
      expect(res.status).toBe(403);
    });

    it(`${c.name} → succès avec Origin matchant`, async () => {
      const res = await c.call({
        origin: 'https://femiglow.ma',
        'content-type': 'application/json',
      });
      expect(res.status).not.toBe(403);
    });
  }
});
