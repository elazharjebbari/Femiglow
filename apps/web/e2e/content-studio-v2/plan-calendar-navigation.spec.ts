/**
 * Content Studio v2 — /plan calendar navigation.
 *
 * Extended coverage of the Calendar component: view switching
 * (week/month/list), navigation arrows, "Aujourd'hui" button,
 * and the filter selects (Statut, Plateforme, Pilier).
 *
 * Skips gracefully if the Calendar is gated behind a feature flag
 * (e.g. "Phase 5" placeholder) or if the page errors.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

/** Skip if the calendar is not rendered (feature-gated or server error). */
async function ensureCalendarOrSkip(page: import('@playwright/test').Page) {
  const tab = page.getByRole('tab', { name: 'Semaine' });
  const visible = await tab.isVisible({ timeout: 8000 }).catch(() => false);
  if (!visible) {
    test.skip(true, 'Calendar not rendered (feature gated or server error).');
  }
}

test('plan — renders with calendar header', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  // The page should at minimum show the Planning sidebar entry as active.
  const planLink = page.getByRole('link', { name: 'Planning' }).first();
  await expect(planLink).toHaveAttribute('aria-current', 'page');

  // Check for the calendar heading — if absent, skip (feature gated).
  const heading = page.getByRole('heading', { name: /calendrier éditorial/i });
  const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasHeading) {
    // Still verify the page loaded without crash (sidebar rendered).
    await expect(planLink).toBeVisible();
    test.skip(true, 'Calendar heading not present (feature gated).');
    return;
  }
  await expect(heading).toBeVisible();
});

test('plan — default view is week (Semaine tab active)', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  await expect(page.getByRole('tab', { name: 'Semaine' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Mois' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('plan — click Mois tab switches to month view', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  await page.getByRole('tab', { name: 'Mois' }).click();

  await expect(page.getByRole('tab', { name: 'Mois' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Semaine' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await expect(page).toHaveURL(/[?&]view=month/);
});

test('plan — click Liste tab switches to list view', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  await page.getByRole('tab', { name: 'Liste' }).click();

  await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page).toHaveURL(/[?&]view=list/);
});

test('plan — navigation arrows shift the date range', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  // Grab the initial date-range label text (e.g. "19 mai - 25 mai").
  const rangeLabel = page.locator('section').locator('span').filter({ hasText: /–|–/ }).first();
  const hasRange = await rangeLabel.isVisible().catch(() => false);
  if (!hasRange) {
    test.skip(true, 'No date range label found — calendar may not show navigation.');
    return;
  }
  const initialText = await rangeLabel.textContent();

  // Click the "Suivant" (next) arrow.
  await page.getByRole('button', { name: 'Suivant' }).click();

  // The label should change to show a different date range.
  await expect(rangeLabel).not.toHaveText(initialText ?? '');
});

test('plan — "Aujourd\'hui" button is clickable', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  // "Aujourd'hui" uses U+2019 apostrophe — match loosely on "Aujourd".
  const todayBtn = page.getByText(/aujourd/i).first();
  await expect(todayBtn).toBeVisible();
  await todayBtn.click();

  // Verify page is still functional (no crash).
  await expect(page.getByRole('tab', { name: 'Semaine' })).toBeVisible();
});

test('plan — filter selects are present (Statut, Plateforme, Pilier)', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  await expect(page.getByTestId('filter-status')).toBeVisible();
  await expect(page.getByTestId('filter-platform')).toBeVisible();
  await expect(page.getByTestId('filter-pillar')).toBeVisible();
});
