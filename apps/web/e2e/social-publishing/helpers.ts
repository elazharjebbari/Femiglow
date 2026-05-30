/**
 * Helpers partagés pour les specs E2E social-publishing.
 *
 * Mocks toutes les routes admin publish via page.route(), permettant des
 * tests déterministes sans backend DB.
 */
import { type Page } from '@playwright/test';

export interface MockJob {
  id: string;
  postId: string;
  accountId: string;
  provider: string;
  platform: string;
  format: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  attemptCount: number;
  lastError: { code: string; message: string; retryable: boolean } | null;
  createdAt: string;
  updatedAt: string;
}

export function makeJob(over: Partial<MockJob> = {}): MockJob {
  return {
    id: 'spj_e2e_1',
    postId: 'post_e2e_1',
    accountId: 'sa_e2e_1',
    provider: 'postiz',
    platform: 'instagram',
    format: 'post',
    status: 'queued',
    scheduledAt: null,
    publishedAt: null,
    attemptCount: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

export interface PublishMocksState {
  retryCalled: boolean;
  cancelCalled: boolean;
  rescheduleCalled: boolean;
  jobsListCalls: number;
  lastRetryId: string | null;
  lastCancelId: string | null;
  jobs: MockJob[];
}

/**
 * Mock toutes les routes /publish-jobs et /posts/* utilisées par
 * JobQueue + QuickEditDrawer + Calendar.
 */
export async function registerPlanMocks(
  page: Page,
  opts: {
    initialJobs?: MockJob[];
    retryOutcome?: 'success' | 'not_found' | 'invalid_state';
    cancelOutcome?: 'success' | 'invalid_state';
  } = {},
): Promise<PublishMocksState> {
  const state: PublishMocksState = {
    retryCalled: false,
    cancelCalled: false,
    rescheduleCalled: false,
    jobsListCalls: 0,
    lastRetryId: null,
    lastCancelId: null,
    jobs: opts.initialJobs ?? [],
  };

  await page.route('**/api/admin/content-studio/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, mode: 'memory', version: 'P3', mockMode: true }),
    }),
  );

  await page.route('**/api/admin/content-studio/publish-jobs*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    state.jobsListCalls += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobs: state.jobs }),
    });
  });

  await page.route('**/api/admin/content-studio/publish-jobs/*/retry', (route) => {
    state.retryCalled = true;
    const url = route.request().url();
    const m = /\/publish-jobs\/([^/]+)\/retry/.exec(url);
    state.lastRetryId = m?.[1] ?? null;
    const outcome = opts.retryOutcome ?? 'success';
    if (outcome === 'not_found') {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'not_found' } }),
      });
    }
    if (outcome === 'invalid_state') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'invalid_state' } }),
      });
    }
    // Update job state: failed → queued
    const idx = state.jobs.findIndex((j) => j.id === state.lastRetryId);
    if (idx >= 0) {
      state.jobs[idx] = { ...state.jobs[idx]!, status: 'queued', attemptCount: state.jobs[idx]!.attemptCount + 1 };
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ job: state.jobs[idx] }),
    });
  });

  await page.route('**/api/admin/content-studio/publish-jobs/*/cancel', (route) => {
    state.cancelCalled = true;
    const url = route.request().url();
    const m = /\/publish-jobs\/([^/]+)\/cancel/.exec(url);
    state.lastCancelId = m?.[1] ?? null;
    const outcome = opts.cancelOutcome ?? 'success';
    if (outcome === 'invalid_state') {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'already_terminal' } }),
      });
    }
    const idx = state.jobs.findIndex((j) => j.id === state.lastCancelId);
    if (idx >= 0) {
      state.jobs[idx] = { ...state.jobs[idx]!, status: 'cancelled' };
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ job: state.jobs[idx] }),
    });
  });

  await page.route('**/api/admin/content-studio/posts/*/reschedule', (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    state.rescheduleCalled = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        post: { id: 'post_e2e_1', status: 'scheduled' },
      }),
    });
  });

  await page.route('**/api/admin/content-studio/posts/*/cancel', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ post: { id: 'post_e2e_1', status: 'cancelled' } }),
    }),
  );

  return state;
}
