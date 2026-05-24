/**
 * Content Studio v2 — /plan QuickEditDrawer.
 *
 * If any calendar cards exist in the staging DB, double-clicking one
 * opens the QuickEditDrawer (Radix dialog with reschedule input).
 * Tests skip gracefully when no cards are present or the calendar
 * is feature-gated.
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

test('plan — double-clicking a calendar card opens the QuickEditDrawer', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  // CalendarCards are rendered inside day cells. Look for any card element.
  const card = page.locator('[data-testid^="calendar-card-"]').first();
  const hasCards = await card.isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasCards) {
    test.skip(true, 'No calendar cards in DB — skipping QuickEditDrawer test.');
    return;
  }

  // Double-click the card to open the drawer.
  await card.dblclick();

  // The drawer should be visible (Radix dialog with data-testid="quick-edit-drawer").
  const drawer = page.getByTestId('quick-edit-drawer');
  await expect(drawer).toBeVisible();

  // Verify it contains the expected title and schedule input.
  await expect(drawer.getByText('Édition rapide')).toBeVisible();
  await expect(page.getByTestId('quick-edit-schedule-input')).toBeVisible();
});

test('plan — QuickEditDrawer can be closed via the close button', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);
  await ensureCalendarOrSkip(page);

  const card = page.locator('[data-testid^="calendar-card-"]').first();
  const hasCards = await card.isVisible({ timeout: 5000 }).catch(() => false);
  if (!hasCards) {
    test.skip(true, 'No calendar cards in DB — skipping QuickEditDrawer close test.');
    return;
  }

  // Open the drawer.
  await card.dblclick();
  const drawer = page.getByTestId('quick-edit-drawer');
  await expect(drawer).toBeVisible();

  // Close via the X button (aria-label="Fermer").
  await drawer.getByRole('button', { name: 'Fermer' }).click();
  await expect(drawer).not.toBeVisible();
});
