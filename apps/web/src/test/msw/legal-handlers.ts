/**
 * MSW handlers — endpoints legal. Réutilisés par les tests de composants
 * admin (LegalEditor, TemplateVarsEditor, PlacementMatrix).
 *
 * Usage :
 *   import { legalHandlers, legalScenarios } from '@/test/msw/legal-handlers';
 *   server.use(...legalHandlers);
 *   server.use(legalScenarios.publishMissingVars(['COMPANY_RC']));
 */
import { HttpResponse, http } from 'msw';

export interface LegalHandlerState {
  pages: Record<string, { slug: string; version: number; status: string }>;
  vars: Record<string, string | null>;
  placements: Array<{
    pageSlug: string;
    zoneKey: string;
    isVisible: boolean;
    displayOrder: number;
    labelOverride: string | null;
  }>;
}

export const defaultLegalState: LegalHandlerState = {
  pages: {
    cgv: { slug: 'cgv', version: 1, status: 'draft' },
  },
  vars: {
    COMPANY_NAME: 'FemiGlow',
    COMPANY_RC: '',
  },
  placements: [],
};

export function legalHandlers(state: LegalHandlerState = defaultLegalState) {
  return [
    // PATCH /api/admin/legal/:slug — update + bump version
    http.patch('/api/admin/legal/:slug', async ({ request, params }) => {
      const slug = String(params.slug);
      const body = (await request.json()) as Record<string, unknown>;
      const existing = state.pages[slug];
      if (!existing) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      const next = { ...existing, version: existing.version + 1 };
      state.pages[slug] = next;
      return HttpResponse.json({
        id: 'lp_x',
        slug,
        title: body.title ?? slug,
        description: body.description ?? null,
        body_md: body.body_md ?? '',
        status: next.status,
        version: next.version,
        updated_at: new Date().toISOString(),
      });
    }),

    // POST /api/admin/legal/:slug/publish — confirm + missing-vars check
    http.post('/api/admin/legal/:slug/publish', async ({ request, params }) => {
      const slug = String(params.slug);
      const body = (await request.json()) as { confirm?: string };
      if (body.confirm !== 'PUBLIER') {
        return HttpResponse.json(
          { error: { code: 'invalid_input', message: 'Tape PUBLIER' } },
          { status: 400 },
        );
      }
      const missing = Object.entries(state.vars)
        .filter(([_, v]) => !v || v.trim() === '')
        .map(([k]) => k);
      if (missing.length > 0) {
        return HttpResponse.json(
          { error: { code: 'missing_required_vars' }, missing },
          { status: 422 },
        );
      }
      const page = state.pages[slug];
      if (!page) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      page.status = 'published';
      page.version += 1;
      return HttpResponse.json({
        status: 'published',
        version: page.version,
        publishedAt: new Date().toISOString(),
      });
    }),

    // PUT /api/admin/legal/template-vars
    http.put('/api/admin/legal/template-vars', async ({ request }) => {
      const body = (await request.json()) as { key: string; value: string | null };
      if (!(body.key in state.vars)) {
        return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
      state.vars[body.key] = body.value;
      return HttpResponse.json({ ok: true });
    }),

    // PUT /api/admin/legal/placements
    http.put('/api/admin/legal/placements', async ({ request }) => {
      const body = (await request.json()) as {
        pageSlug: string;
        zoneKey: string;
        isVisible?: boolean;
        displayOrder?: number;
        labelOverride?: string | null;
      };
      const idx = state.placements.findIndex(
        (p) => p.pageSlug === body.pageSlug && p.zoneKey === body.zoneKey,
      );
      const next = {
        pageSlug: body.pageSlug,
        zoneKey: body.zoneKey,
        isVisible: body.isVisible ?? true,
        displayOrder: body.displayOrder ?? 0,
        labelOverride: body.labelOverride ?? null,
      };
      if (idx >= 0) state.placements[idx] = next;
      else state.placements.push(next);
      return HttpResponse.json({ ok: true });
    }),

    // POST /api/admin/legal/health/recheck
    http.post('/api/admin/legal/health/recheck', () => {
      return HttpResponse.json({ ok: true, checked: 0, inserted: 0 });
    }),
  ];
}

export const legalScenarios = {
  /** Force le PATCH à échouer (réseau / 500). */
  patchFails: (slug: string) =>
    http.patch(`/api/admin/legal/${slug}`, () =>
      HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 }),
    ),

  /** Force le PATCH à renvoyer 409 version_conflict. */
  patchConflict: (slug: string, currentUpdatedAtIso = new Date().toISOString()) =>
    http.patch(`/api/admin/legal/${slug}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'version_conflict',
            message: 'La page a été modifiée par un autre admin.',
            currentUpdatedAt: currentUpdatedAtIso,
          },
        },
        { status: 409 },
      ),
    ),

  /** Force le publish à renvoyer 422 missing_required_vars. */
  publishMissingVars: (missing: string[]) =>
    http.post('/api/admin/legal/:slug/publish', () =>
      HttpResponse.json(
        { error: { code: 'missing_required_vars' }, missing },
        { status: 422 },
      ),
    ),

  /** Force le publish à renvoyer 400 confirm mismatch. */
  publishConfirmMismatch: () =>
    http.post('/api/admin/legal/:slug/publish', () =>
      HttpResponse.json(
        { error: { code: 'invalid_input', message: 'Tape PUBLIER pour confirmer.' } },
        { status: 400 },
      ),
    ),

  /** Force la sauvegarde de var template à renvoyer 422. */
  varUpdateInvalid: () =>
    http.put('/api/admin/legal/template-vars', () =>
      HttpResponse.json({ error: { code: 'validation_failed' } }, { status: 422 }),
    ),

  /** Simule une erreur réseau (TypeError côté client : fetch failed). */
  networkError: (path: string, method: 'patch' | 'post' | 'put' = 'patch') =>
    (http as unknown as Record<string, (p: string, h: () => Response) => unknown>)[method]!(
      path,
      () => HttpResponse.error(),
    ),

  /** Simule une réponse lente (ms) — utile pour tester les loaders/timeouts. */
  slowResponse: (path: string, ms: number, method: 'patch' | 'post' | 'put' = 'patch') =>
    (http as unknown as Record<string, (p: string, h: () => Promise<Response>) => unknown>)[
      method
    ]!(path, async () => {
      await new Promise((r) => setTimeout(r, ms));
      return HttpResponse.json({ ok: true });
    }),

  /** Simule 5xx intermittent (1 fail puis succès). */
  intermittentFailure: (slug: string) => {
    let failed = false;
    return http.patch(`/api/admin/legal/${slug}`, () => {
      if (!failed) {
        failed = true;
        return HttpResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
      }
      return HttpResponse.json({
        id: 'lp_x',
        slug,
        title: 'Recovered',
        description: null,
        body_md: 'x',
        status: 'draft',
        version: 1,
        updated_at: new Date().toISOString(),
      });
    });
  },

  /** Simule un 429 rate-limited avec Retry-After. */
  rateLimited: (path: string, retryAfterSec = 60) =>
    http.post(path, () =>
      HttpResponse.json(
        { error: { code: 'rate_limited', message: 'Trop de requêtes' } },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      ),
    ),

  /** Simule un 403 CSRF. */
  csrfForbidden: (path: string, method: 'patch' | 'post' | 'put' = 'patch') =>
    (http as unknown as Record<string, (p: string, h: () => Response) => unknown>)[method]!(
      path,
      () => HttpResponse.json({ error: { code: 'forbidden' } }, { status: 403 }),
    ),
};
