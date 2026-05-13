/**
 * Tests intégration — POST /api/admin/legal/preview.
 * Auth + CSRF + validation + rendu pipeline serveur (unified+sanitize).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_p',
  email: 'p@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
}));

vi.mock('@/lib/legal/repository', () => ({
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
}));

import { POST as previewRoute } from '@/app/api/admin/legal/preview/route';

beforeEach(() => {
  // session is global
});

describe('POST /api/admin/legal/preview', () => {
  it('200 + html sanitized', async () => {
    const res = await previewRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ bodyMd: '# Hello\n\nText.' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string; headings: unknown[] };
    expect(body.html).toContain('<h1');
    expect(body.html).toContain('Hello');
  });

  it('XSS purgé', async () => {
    const res = await previewRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ bodyMd: '<script>alert(1)</script>' }),
      }),
    );
    const body = (await res.json()) as { html: string };
    expect(body.html).not.toMatch(/<script/i);
  });

  it('400 si JSON invalide', async () => {
    const res = await previewRoute(
      new Request('http://x', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
  });

  it('400 si bodyMd manquant', async () => {
    const res = await previewRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({}) }),
    );
    expect(res.status).toBe(400);
  });

  it('mode=admin-preview garde le nom de la var visible si manquante', async () => {
    const res = await previewRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ bodyMd: 'RC : {{COMPANY_RC}}', mode: 'admin-preview' }),
      }),
    );
    const body = (await res.json()) as { html: string };
    // Le nom de la variable doit rester visible (pour signaler à l'admin
    // qu'il manque cette donnée). L'enveloppe <mark> visuelle est
    // souhaitée mais filtrée par sanitize au niveau du source MD —
    // V1.1 : injecter via rehype plugin post-parse.
    expect(body.html).toContain('COMPANY_RC');
  });

  it('headings extraits', async () => {
    const res = await previewRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ bodyMd: '# T\n\n## A\n\n### B' }),
      }),
    );
    const body = (await res.json()) as {
      headings: Array<{ depth: number; text: string }>;
    };
    expect(body.headings).toHaveLength(2); // H2 + H3 only
    expect(body.headings[0]?.text).toBe('A');
    expect(body.headings[1]?.text).toBe('B');
  });

  it('refuse bodyMd > 200kb (validation Zod)', async () => {
    const huge = 'x'.repeat(200_001);
    const res = await previewRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ bodyMd: huge }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/legal/preview — auth', () => {
  it('401 sans session', async () => {
    const mod = await import('@/lib/auth/require-admin');
    vi.spyOn(mod, 'getAdminSession').mockResolvedValueOnce(null);
    const res = await previewRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ bodyMd: 'x' }) }),
    );
    expect(res.status).toBe(401);
  });
});
