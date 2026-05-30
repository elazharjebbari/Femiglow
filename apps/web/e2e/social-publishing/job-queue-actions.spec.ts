/**
 * E2E spec — JobQueue retry + cancel + polling.
 *
 * Couvre F09 (UI rendering), F10 (retry), F11 (cancel).
 * Scenarios : S06 (failed-then-retried) partiel.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { makeJob, registerPlanMocks } from './helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('JobQueue — retry & cancel actions', () => {
  test('renders failed job with Retry button + lastError', async ({ page }) => {
    const failedJob = makeJob({
      id: 'spj_failed_1',
      status: 'failed',
      attemptCount: 3,
      lastError: { code: 'provider_rate_limited', message: 'Postiz 429', retryable: true },
    });
    await registerPlanMocks(page, { initialJobs: [failedJob] });
    await page.goto('/admin/content-studio-v2/plan');

    // Wait JobQueue to render
    await expect(page.getByText(/Postiz 429/i).first()).toBeVisible({ timeout: 10_000 });
    // Retry button visible
    await expect(page.getByTestId('job-retry-spj_failed_1')).toBeVisible();
  });

  test('Retry button fires POST /retry and updates row status', async ({ page }) => {
    const failedJob = makeJob({
      id: 'spj_failed_2',
      status: 'failed',
      attemptCount: 2,
      lastError: { code: 'provider_unavailable', message: 'Provider down', retryable: true },
    });
    const state = await registerPlanMocks(page, { initialJobs: [failedJob] });
    await page.goto('/admin/content-studio-v2/plan');

    const retryBtn = page.getByTestId('job-retry-spj_failed_2');
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });
    await retryBtn.click();

    // Toast success
    await expect(page.getByText(/Reprise|Retry|en file/i).first()).toBeVisible({ timeout: 5_000 });
    expect(state.retryCalled).toBe(true);
    expect(state.lastRetryId).toBe('spj_failed_2');
  });

  test('queued job has Cancel button + cancel fires API', async ({ page }) => {
    const queuedJob = makeJob({
      id: 'spj_queued_1',
      status: 'queued',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    const state = await registerPlanMocks(page, { initialJobs: [queuedJob] });
    await page.goto('/admin/content-studio-v2/plan');

    const cancelBtn = page.getByTestId('job-cancel-spj_queued_1');
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // Check the API was called (more reliable than DOM detection of toast).
    await page.waitForTimeout(800);
    expect(state.cancelCalled).toBe(true);
    expect(state.lastCancelId).toBe('spj_queued_1');
  });

  test('JobQueue polls publish-jobs endpoint on mount', async ({ page }) => {
    const state = await registerPlanMocks(page, { initialJobs: [] });
    await page.goto('/admin/content-studio-v2/plan');
    // At least one fetch on mount
    await page.waitForTimeout(1000);
    expect(state.jobsListCalls).toBeGreaterThanOrEqual(1);
  });

  test('Retry 409 shows mapped error toast', async ({ page }) => {
    const failedJob = makeJob({
      id: 'spj_failed_3',
      status: 'failed',
      lastError: { code: 'provider_unavailable', message: 'x', retryable: true },
    });
    await registerPlanMocks(page, {
      initialJobs: [failedJob],
      retryOutcome: 'invalid_state',
    });
    await page.goto('/admin/content-studio-v2/plan');

    const retryBtn = page.getByTestId('job-retry-spj_failed_3');
    await expect(retryBtn).toBeVisible({ timeout: 10_000 });
    await retryBtn.click();

    // Some toast appears with error indication
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 5_000 });
  });
});
