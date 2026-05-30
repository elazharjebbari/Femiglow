/**
 * MSW catalog — Content Studio v2 / Social Publishing admin routes.
 *
 * Source of truth for HTTP mocks used by:
 *  - Vitest component tests (via setupServer)
 *  - Playwright E2E mocked specs (via applyPlaywrightRoutes helper)
 *
 * 9 admin routes + ancillary (health, generation-runs, media list) are
 * covered, each with a "happy" default + named variant overrides
 * (rate_limited, auth_failed, etc.).
 *
 * Cf docs/social-publishing-test-battery/test-battery/06-msw-handlers-catalog.yaml
 */

import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  SocialPublishJob,
  SocialPublishJobStatus,
  SocialAccount,
  SocialPublishMode,
} from '@/lib/social-publishing/contracts';

// ---------------------------------------------------------------------------
// State store
// ---------------------------------------------------------------------------

/**
 * In-memory store maintaining job + idempotency state across calls within a
 * single test. Reset between tests via `resetPublishMockStore()`.
 */
class PublishMockStore {
  private jobs = new Map<string, SocialPublishJob>();
  private idempotencyMap = new Map<string, string>(); // key → jobId
  public calls = {
    publishNow: 0,
    schedule: 0,
    draft: 0,
    cancel: 0,
    reschedule: 0,
    jobsList: 0,
    jobRetry: 0,
    jobCancel: 0,
    postizSync: 0,
  };

  reset() {
    this.jobs.clear();
    this.idempotencyMap.clear();
    this.calls = {
      publishNow: 0,
      schedule: 0,
      draft: 0,
      cancel: 0,
      reschedule: 0,
      jobsList: 0,
      jobRetry: 0,
      jobCancel: 0,
      postizSync: 0,
    };
  }

  seedJobs(jobs: SocialPublishJob[]) {
    for (const j of jobs) this.jobs.set(j.id, j);
  }

  findByIdempotency(key: string): SocialPublishJob | null {
    const id = this.idempotencyMap.get(key);
    return id ? this.jobs.get(id) ?? null : null;
  }

  recordJob(j: SocialPublishJob) {
    this.jobs.set(j.id, j);
    this.idempotencyMap.set(j.idempotencyKey, j.id);
  }

  listJobs(filter?: { status?: SocialPublishJobStatus; accountId?: string; postId?: string }): SocialPublishJob[] {
    let out = [...this.jobs.values()];
    if (filter?.status) out = out.filter((j) => j.status === filter.status);
    if (filter?.accountId) out = out.filter((j) => j.accountId === filter.accountId);
    if (filter?.postId) out = out.filter((j) => j.postId === filter.postId);
    return out.sort((a, b) => b.id.localeCompare(a.id));
  }

  updateJob(id: string, patch: Partial<SocialPublishJob>): SocialPublishJob | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    const next = { ...job, ...patch };
    this.jobs.set(id, next);
    return next;
  }
}

const store = new PublishMockStore();

export function getPublishMockStore(): PublishMockStore {
  return store;
}

export function resetPublishMockStore(): void {
  store.reset();
}

// ---------------------------------------------------------------------------
// Variant types
// ---------------------------------------------------------------------------

export type PublishNowVariant =
  | 'success'
  | 'rate_limited'
  | 'budget_exceeded'
  | 'auth_failed'
  | 'no_account'
  | 'brand_blocked'
  | 'no_media'
  | 'caption_too_long'
  | 'idempotency_replay'
  | 'server_error';

export type ScheduleVariant =
  | 'success'
  | 'past_date'
  | 'min_lead'
  | 'invalid_input'
  | 'brand_blocked';

export type DraftVariant =
  | 'success'
  | 'capability_not_supported'
  | 'server_error';

export type CancelVariant = 'success' | 'already_terminal' | 'not_found';

export type RescheduleVariant = 'success' | 'past_date' | 'invalid_state';

export type JobsListVariant = 'success' | 'empty' | 'unauthorized';

export type JobRetryVariant = 'success' | 'not_in_failed' | 'not_found';

export type JobCancelVariant = 'success' | 'already_terminal';

export type PostizSyncVariant = 'success' | 'unauthorized' | 'partial';

export interface PublishMocksOpts {
  publishNow?: PublishNowVariant;
  schedule?: ScheduleVariant;
  draft?: DraftVariant;
  cancel?: CancelVariant;
  reschedule?: RescheduleVariant;
  jobsList?: JobsListVariant;
  jobRetry?: JobRetryVariant;
  jobCancel?: JobCancelVariant;
  postizSync?: PostizSyncVariant;
  mockMode?: boolean;
  initialJobs?: SocialPublishJob[];
  initialAccounts?: SocialAccount[];
  /** Budget remaining in cents (default 95/100). */
  budgetRemainingCents?: number;
}

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function nowJob(overrides: Partial<SocialPublishJob> = {}): SocialPublishJob {
  const id = overrides.id ?? `spj_mock_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    postId: overrides.postId ?? 'post_mock_1',
    accountId: overrides.accountId ?? 'sa_mock_1',
    provider: overrides.provider ?? 'postiz',
    platform: overrides.platform ?? 'instagram',
    format: overrides.format ?? 'post',
    status: overrides.status ?? 'published',
    idempotencyKey: overrides.idempotencyKey ?? `key_${id}`,
    content: overrides.content ?? {
      sourcePostId: 'post_mock_1',
      platform: 'instagram',
      format: 'post',
      caption: 'Mock caption',
      media: [],
      publishMode: 'now' as SocialPublishMode,
    },
    scheduledAt: overrides.scheduledAt ?? null,
    publishedAt: overrides.publishedAt ?? new Date(),
    lockedAt: overrides.lockedAt ?? null,
    attemptCount: overrides.attemptCount ?? 1,
    lastError: overrides.lastError ?? null,
    requestedBy: overrides.requestedBy ?? 'admin_test',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  } as SocialPublishJob;
}

// ---------------------------------------------------------------------------
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Create the array of MSW handlers for a given test scenario.
 *
 * Default behaviour: all routes return success. Override per route via
 * named variants. The store keeps call counts + idempotency state.
 */
export function createPublishHandlers(opts: PublishMocksOpts = {}): HttpHandler[] {
  if (opts.initialJobs) {
    store.reset();
    store.seedJobs(opts.initialJobs);
  }

  const handlers: HttpHandler[] = [];

  // ── /health ───────────────────────────────────────────────────────────
  handlers.push(
    http.get('*/api/admin/content-studio/health', () =>
      HttpResponse.json({
        ok: true,
        mode: 'memory',
        version: 'P3',
        mockMode: opts.mockMode ?? false,
      }),
    ),
  );

  // ── /generation-runs (for budget indicator) ───────────────────────────
  handlers.push(
    http.get('*/api/admin/content-studio/generation-runs', () =>
      HttpResponse.json({
        runs: [],
        budget: {
          dailyBudgetCents: 100,
          dailySpentCents: 100 - (opts.budgetRemainingCents ?? 95),
          remainingCents: opts.budgetRemainingCents ?? 95,
        },
      }),
    ),
  );

  // ── /media (list) ─────────────────────────────────────────────────────
  handlers.push(
    http.get('*/api/admin/content-studio/media', () =>
      HttpResponse.json({
        items: [],
        pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null },
      }),
    ),
  );

  // ── POST /posts/:id/publish-now ───────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/posts/:id/publish-now', async ({ request, params }) => {
      store.calls.publishNow += 1;
      const variant = opts.publishNow ?? 'success';
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const postId = String(params.id);
      const idempotencyKey =
        (body.idempotencyKey as string) ?? `content-studio:${postId}:now`;

      // Idempotency replay
      const existing = store.findByIdempotency(idempotencyKey);
      if (existing) {
        return HttpResponse.json({ status: existing.status, jobs: [existing] }, { status: 201 });
      }

      switch (variant) {
        case 'rate_limited':
          return HttpResponse.json(
            { error: { code: 'provider_rate_limited', message: 'Provider rate limited' } },
            { status: 429 },
          );
        case 'budget_exceeded':
          return HttpResponse.json(
            { error: { code: 'budget_exceeded', message: 'Budget atteint' } },
            { status: 402 },
          );
        case 'auth_failed':
          return HttpResponse.json(
            { error: { code: 'token_expired', message: 'Compte expiré' } },
            { status: 401 },
          );
        case 'no_account':
          return HttpResponse.json(
            { error: { code: 'no_account_connected', message: 'Aucun compte connecté' } },
            { status: 409 },
          );
        case 'brand_blocked':
          return HttpResponse.json(
            { error: { code: 'brand_review_blocked', message: 'Bloqué' } },
            { status: 409 },
          );
        case 'no_media':
          return HttpResponse.json(
            { error: { code: 'no_media_attached', message: 'Aucun média' } },
            { status: 409 },
          );
        case 'caption_too_long':
          return HttpResponse.json(
            { error: { code: 'caption_too_long', message: 'Caption too long' } },
            { status: 409 },
          );
        case 'server_error':
          return HttpResponse.json(
            { error: { code: 'provider_unavailable', message: 'Provider down' } },
            { status: 503 },
          );
        case 'success':
        default: {
          const job = nowJob({
            postId,
            idempotencyKey,
            status: 'published',
            accountId: (body.accountId as string) ?? 'sa_mock_1',
          });
          store.recordJob(job);
          return HttpResponse.json({ status: 'queued', jobs: [job] }, { status: 201 });
        }
      }
    }),
  );

  // ── POST /posts/:id/schedule ──────────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/posts/:id/schedule', async ({ request, params }) => {
      store.calls.schedule += 1;
      const variant = opts.schedule ?? 'success';
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const postId = String(params.id);

      if (!body.scheduledAt) {
        return HttpResponse.json(
          { error: { code: 'invalid_input', message: 'scheduledAt required' } },
          { status: 400 },
        );
      }

      switch (variant) {
        case 'past_date':
          return HttpResponse.json(
            { error: { code: 'invalid_date', message: 'Date dans le passé' } },
            { status: 400 },
          );
        case 'min_lead':
          return HttpResponse.json(
            { error: { code: 'min_lead_time', message: '5 minutes minimum' } },
            { status: 400 },
          );
        case 'invalid_input':
          return HttpResponse.json(
            { error: { code: 'invalid_input', message: 'Bad request' } },
            { status: 400 },
          );
        case 'brand_blocked':
          return HttpResponse.json(
            { error: { code: 'brand_review_blocked', message: 'Bloqué' } },
            { status: 409 },
          );
        case 'success':
        default: {
          const scheduledAt = new Date(String(body.scheduledAt));
          const job = nowJob({
            postId,
            status: 'queued',
            scheduledAt,
            publishedAt: null,
            content: {
              sourcePostId: postId,
              platform: 'instagram',
              format: 'post',
              caption: 'Scheduled mock',
              media: [],
              publishMode: 'schedule' as SocialPublishMode,
              scheduledAt,
            },
          });
          store.recordJob(job);
          return HttpResponse.json({ status: 'scheduled', jobs: [job] }, { status: 201 });
        }
      }
    }),
  );

  // ── POST /posts/:id/draft-on-provider ─────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/posts/:id/draft-on-provider', async ({ params }) => {
      store.calls.draft += 1;
      const variant = opts.draft ?? 'success';
      const postId = String(params.id);

      switch (variant) {
        case 'capability_not_supported':
          return HttpResponse.json(
            { error: { code: 'capability_not_supported', message: 'Not supported' } },
            { status: 409 },
          );
        case 'server_error':
          return HttpResponse.json(
            { error: { code: 'provider_unavailable', message: 'Provider down' } },
            { status: 503 },
          );
        case 'success':
        default: {
          const job = nowJob({
            postId,
            status: 'published',
            content: {
              sourcePostId: postId,
              platform: 'instagram',
              format: 'post',
              caption: 'Draft mock',
              media: [],
              publishMode: 'draft' as SocialPublishMode,
            },
          });
          store.recordJob(job);
          return HttpResponse.json({ status: 'approved', jobs: [job] }, { status: 201 });
        }
      }
    }),
  );

  // ── POST /posts/:id/cancel ────────────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/posts/:id/cancel', async ({ params }) => {
      store.calls.cancel += 1;
      const variant = opts.cancel ?? 'success';
      const postId = String(params.id);

      switch (variant) {
        case 'already_terminal':
          return HttpResponse.json(
            { error: { code: 'already_terminal', message: 'Déjà terminé' } },
            { status: 409 },
          );
        case 'not_found':
          return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
        case 'success':
        default:
          return HttpResponse.json(
            {
              post: {
                id: postId,
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
              },
            },
            { status: 200 },
          );
      }
    }),
  );

  // ── PATCH /posts/:id/reschedule ───────────────────────────────────────
  handlers.push(
    http.patch('*/api/admin/content-studio/posts/:id/reschedule', async ({ request, params }) => {
      store.calls.reschedule += 1;
      const variant = opts.reschedule ?? 'success';
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const postId = String(params.id);

      switch (variant) {
        case 'past_date':
          return HttpResponse.json(
            { error: { code: 'invalid_date', message: 'Date dans le passé' } },
            { status: 400 },
          );
        case 'invalid_state':
          return HttpResponse.json(
            { error: { code: 'invalid_state', message: 'État invalide' } },
            { status: 409 },
          );
        case 'success':
        default:
          return HttpResponse.json(
            {
              post: {
                id: postId,
                status: 'scheduled',
                scheduledAt: body.scheduledAt,
              },
            },
            { status: 200 },
          );
      }
    }),
  );

  // ── GET /publish-jobs ─────────────────────────────────────────────────
  handlers.push(
    http.get('*/api/admin/content-studio/publish-jobs', ({ request }) => {
      store.calls.jobsList += 1;
      const variant = opts.jobsList ?? 'success';
      if (variant === 'unauthorized') {
        return HttpResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
      }
      const url = new URL(request.url);
      const status = url.searchParams.get('status') as SocialPublishJobStatus | null;
      const accountId = url.searchParams.get('accountId');
      const postId = url.searchParams.get('postId');
      const filtered = store.listJobs({
        status: status ?? undefined,
        accountId: accountId ?? undefined,
        postId: postId ?? undefined,
      });
      if (variant === 'empty') {
        return HttpResponse.json({
          jobs: [],
          pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null },
          count: 0,
        });
      }
      return HttpResponse.json({
        jobs: filtered,
        pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null },
        count: filtered.length,
      });
    }),
  );

  // ── POST /publish-jobs/:id/retry ──────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/publish-jobs/:id/retry', ({ params }) => {
      store.calls.jobRetry += 1;
      const variant = opts.jobRetry ?? 'success';
      const id = String(params.id);

      switch (variant) {
        case 'not_in_failed':
          return HttpResponse.json(
            { error: { code: 'invalid_state', message: 'Not failed' } },
            { status: 409 },
          );
        case 'not_found':
          return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
        case 'success':
        default: {
          const updated = store.updateJob(id, {
            status: 'queued',
            lockedAt: null,
            attemptCount: 1,
          });
          return HttpResponse.json(
            { job: updated ?? nowJob({ id, status: 'queued' }) },
            { status: 200 },
          );
        }
      }
    }),
  );

  // ── POST /publish-jobs/:id/cancel ─────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/publish-jobs/:id/cancel', ({ params }) => {
      store.calls.jobCancel += 1;
      const variant = opts.jobCancel ?? 'success';
      const id = String(params.id);

      switch (variant) {
        case 'already_terminal':
          return HttpResponse.json(
            { error: { code: 'already_terminal', message: 'Déjà terminé' } },
            { status: 409 },
          );
        case 'success':
        default: {
          const updated = store.updateJob(id, { status: 'cancelled', lockedAt: null });
          return HttpResponse.json(
            { job: updated ?? nowJob({ id, status: 'cancelled' }) },
            { status: 200 },
          );
        }
      }
    }),
  );

  // ── POST /postiz/integrations/sync ────────────────────────────────────
  handlers.push(
    http.post('*/api/admin/content-studio/postiz/integrations/sync', () => {
      store.calls.postizSync += 1;
      const variant = opts.postizSync ?? 'success';

      switch (variant) {
        case 'unauthorized':
          return HttpResponse.json({ error: { code: 'token_expired' } }, { status: 401 });
        case 'partial':
          return HttpResponse.json({
            accounts: opts.initialAccounts ?? [],
            summary: { total: 2, added: 1, updated: 0, disabled: 1 },
            errors: [{ id: 'partial_1', code: 'invalid_payload' }],
          });
        case 'success':
        default:
          return HttpResponse.json({
            accounts: opts.initialAccounts ?? [],
            summary: { total: 2, added: 2, updated: 0, disabled: 0 },
          });
      }
    }),
  );

  return handlers;
}

// ---------------------------------------------------------------------------
// Playwright bridge — apply same handlers via page.route()
// ---------------------------------------------------------------------------

/**
 * Translate MSW handlers into Playwright `page.route()` registrations.
 * Used by E2E specs that share the same scenario configuration as
 * component tests.
 *
 * Note: this implementation re-runs the MSW handler logic to compute the
 * response. We bypass MSW's HTTP intercept and replay the route directly
 * onto the page request stream.
 */
export async function applyPlaywrightRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  opts: PublishMocksOpts = {},
): Promise<{ store: PublishMockStore }> {
  resetPublishMockStore();
  const handlers = createPublishHandlers(opts);

  for (const handler of handlers) {
    // MSW handlers have a `info` field with method + path patterns.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = (handler as any).info;
    if (!info?.path || !info?.method) continue;
    const pathRegex = mswPathToPlaywrightPattern(info.path as string);

    await page.route(pathRegex, async (route: { request: () => Request; fulfill: (r: { status: number; contentType: string; body: string }) => Promise<void> }) => {
      const req = route.request();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchReq = new Request((req as any).url(), {
        method: info.method,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers: (req as any).headers(),
        body: ['POST', 'PATCH', 'PUT'].includes(info.method as string)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? ((req as any).postData() as string | undefined)
          : undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = extractParams(info.path as string, (req as any).url() as string);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolver = (handler as any).resolver;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await resolver({ request: fetchReq, params } as any);
      const response = result instanceof HttpResponse ? result : (result as Response);
      const status = response.status;
      const body = await response.text();
      await route.fulfill({
        status,
        contentType: 'application/json',
        body,
      });
    });
  }

  return { store };
}

function mswPathToPlaywrightPattern(path: string): RegExp {
  // Translate "*/api/.../posts/:id/publish-now" → matching regex
  const escaped = path
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/^\\\*/, '.*')
    .replace(/:[a-zA-Z_]+/g, '[^/]+');
  return new RegExp(`^${escaped}(\\?.*)?$`);
}

function extractParams(pathPattern: string, actualUrl: string): Record<string, string> {
  const u = new URL(actualUrl);
  const segs = u.pathname.split('/').filter(Boolean);
  const patternSegs = pathPattern.replace(/^\*/, '').split('/').filter(Boolean);
  const out: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const ps = patternSegs[i]!;
    if (ps.startsWith(':')) {
      out[ps.slice(1)] = segs[i] ?? '';
    }
  }
  return out;
}
