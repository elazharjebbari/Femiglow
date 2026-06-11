/**
 * Content Studio v2 — Job Queue tests on /plan page.
 *
 * The JobQueue component renders at the bottom of the /plan page and
 * shows publish jobs with statuses queued/publishing/failed from the
 * last 7 days. Tests are resilient to empty state.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('job-queue — section visible on /plan page', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  // The JobQueue section has an aria heading "File de publication"
  await expect(
    page.getByRole('heading', { name: /file de publication/i }),
  ).toBeVisible();
});

test('job-queue — retry button on failed job triggers toast', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  // Check if any failed jobs exist (retry buttons are on all non-publishing jobs)
  const retryButtons = page.locator('[data-testid^="job-retry-"]');
  const retryCount = await retryButtons.count();

  if (retryCount === 0) {
    test.skip(true, 'No jobs with retry button visible — skipping.');
    return;
  }

  const firstRetry = retryButtons.first();
  const retryTestId = await firstRetry.getAttribute('data-testid');
  const jobId = retryTestId?.replace('job-retry-', '') ?? '';

  // Mock retry endpoint
  await page.route(`**/publish-jobs/${jobId}/retry`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Mock list endpoint for refetch after retry
  await page.route('**/publish-jobs', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [] }),
      });
    } else {
      await route.continue();
    }
  });

  await firstRetry.click();

  await expect(page.getByText(/reprise demandée/i)).toBeVisible({ timeout: 5000 });
});

test('job-queue — cancel button on queued job triggers toast', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const cancelButtons = page.locator('[data-testid^="job-cancel-"]');
  const cancelCount = await cancelButtons.count();

  if (cancelCount === 0) {
    test.skip(true, 'No jobs with cancel button visible — skipping.');
    return;
  }

  const firstCancel = cancelButtons.first();
  const cancelTestId = await firstCancel.getAttribute('data-testid');
  const jobId = cancelTestId?.replace('job-cancel-', '') ?? '';

  // Mock cancel endpoint
  await page.route(`**/publish-jobs/${jobId}/cancel`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  // Mock list endpoint for refetch after cancel
  await page.route('**/publish-jobs', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [] }),
      });
    } else {
      await route.continue();
    }
  });

  await firstCancel.click();

  await expect(page.getByText(/job annulé/i)).toBeVisible({ timeout: 5000 });
});

test('job-queue — empty state shows "Aucun job actif"', async ({ page }) => {
  // Mock the publish-jobs list endpoint to return empty BEFORE navigating
  await page.route('**/publish-jobs', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [] }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  // The empty state text includes "Aucun job actif"
  await expect(page.getByText(/aucun job actif/i)).toBeVisible({ timeout: 10000 });
});

test('job-queue — refresh button triggers fetch', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  let fetchCount = 0;
  await page.route('**/publish-jobs', async (route) => {
    if (route.request().method() === 'GET') {
      fetchCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [] }),
      });
    } else {
      await route.continue();
    }
  });

  // Click the Refresh button ("Rafraîchir")
  const refreshButton = page.getByRole('button', { name: /rafraîchir/i });
  await expect(refreshButton).toBeVisible();
  await refreshButton.click();

  // Wait for the fetch to complete
  await page.waitForTimeout(1000);

  // At least one fetch should have been triggered by the click
  expect(fetchCount).toBeGreaterThanOrEqual(1);
});

test('job-queue — network error on list shows error toast', async ({ page }) => {
  // Mock the list endpoint to fail BEFORE navigating
  await page.route('**/publish-jobs', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  // The error surfaces twice (statut inline + toast) → .first() pour éviter
  // la violation strict-mode.
  await expect(page.getByText(/échec rafraîchissement jobs/i).first()).toBeVisible({ timeout: 10000 });
});
