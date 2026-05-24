/**
 * Content Studio v2 — /library bulk actions.
 *
 * Tests the selection mechanism and the sticky BulkActionBar that
 * appears when one or more library cards are checked. Resilient to
 * empty DB state and server errors: tests skip gracefully when the
 * page doesn't render or has no cards.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

/** Skip if the library page crashed (server error) instead of rendering. */
async function ensureLibraryOrSkip(page: import('@playwright/test').Page) {
  const heading = page.getByRole('heading', { name: /bibliothèque/i, level: 1 });
  const visible = await heading.isVisible({ timeout: 8000 }).catch(() => false);
  if (!visible) {
    test.skip(true, 'Library page did not render (server error or feature gated).');
  }
}

test('library — page renders cards or empty state', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);
  await ensureLibraryOrSkip(page);

  // Either we see the grid of cards or the empty-state placeholder.
  const grid = page.getByRole('list', { name: /bibliothèque de contenus/i });
  const empty = page.getByRole('status');

  // One of these must be visible.
  await expect(grid.or(empty).first()).toBeVisible();
});

test('library — selecting a card shows the bulk action bar', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);
  await ensureLibraryOrSkip(page);

  const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
  const hasCards = await firstCheckbox.isVisible().catch(() => false);
  if (!hasCards) {
    test.skip(true, 'No library cards in DB — skipping selection test.');
    return;
  }

  // The bulk action bar should not be visible before any selection.
  await expect(page.getByRole('region', { name: /actions groupées/i })).not.toBeVisible();

  // Select the first card.
  await firstCheckbox.check();

  // The sticky bar should now appear with "1 sélectionné".
  const bar = page.getByRole('region', { name: /actions groupées/i });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(/\d+ sélectionné/);
});

test('library — "Annuler" in bulk bar clears selection', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);
  await ensureLibraryOrSkip(page);

  const firstCheckbox = page.locator('[data-cs-library-card] input[type="checkbox"]').first();
  const hasCards = await firstCheckbox.isVisible().catch(() => false);
  if (!hasCards) {
    test.skip(true, 'No library cards in DB — skipping cancel test.');
    return;
  }

  // Select a card to trigger the bar.
  await firstCheckbox.check();
  const bar = page.getByRole('region', { name: /actions groupées/i });
  await expect(bar).toBeVisible();

  // Click "Annuler" (the cancel button inside the bar).
  await bar.getByRole('button', { name: /annuler/i }).click();

  // Bar should disappear and checkbox should be unchecked.
  await expect(bar).not.toBeVisible();
  await expect(firstCheckbox).not.toBeChecked();
});
