/**
 * Content Studio v2 — Library error scenarios.
 *
 * Uses `page.route()` to simulate server errors and validates that the
 * UI surfaces appropriate toasts and handles rollback correctly.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('library-errors — duplicate fails (POST variation 500) shows error toast', async ({
  page,
}) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  // Mock the variation endpoint to fail
  await page.route('**/variation', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    } else {
      await route.continue();
    }
  });

  // Find a library card with a "Dupliquer" action button
  const libraryCards = page.locator('[data-cs-library-card]');
  const cardCount = await libraryCards.count();

  if (cardCount === 0) {
    test.skip(true, 'No library cards available — skipping duplicate test.');
    return;
  }

  // Hover over the first card to reveal action buttons
  const firstCard = libraryCards.first();
  await firstCard.hover();

  // Click the "Dupliquer" button
  const dupButton = firstCard.getByRole('button', { name: /dupliquer/i });
  if ((await dupButton.count()) === 0) {
    test.skip(true, 'Dupliquer button not found on library card — skipping.');
    return;
  }
  await dupButton.click();

  // Expect error toast
  await expect(page.getByText(/la duplication a échoué/i)).toBeVisible({ timeout: 5000 });
});

test('library-errors — archive rollback (POST archive 500) card reappears + error toast', async ({
  page,
}) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  // Mock the archive endpoint to fail
  await page.route('**/archive', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    } else {
      await route.continue();
    }
  });

  const libraryCards = page.locator('[data-cs-library-card]');
  const cardCount = await libraryCards.count();

  if (cardCount === 0) {
    test.skip(true, 'No library cards available — skipping archive test.');
    return;
  }

  const initialCount = cardCount;

  // Hover over the first card to reveal action buttons
  const firstCard = libraryCards.first();
  await firstCard.hover();

  // Click the "Archiver" button
  const archiveButton = firstCard.getByRole('button', { name: /archiver/i });
  if ((await archiveButton.count()) === 0) {
    test.skip(true, 'Archiver button not found on library card — skipping.');
    return;
  }
  await archiveButton.click();

  // Expect error toast about archiving failure
  await expect(page.getByText(/archivage refusé/i)).toBeVisible({ timeout: 5000 });

  // Card count should be restored after rollback
  await expect(libraryCards).toHaveCount(initialCount, { timeout: 5000 });
});

test('library-errors — restrictive filters show empty state', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  // Apply a very restrictive search query that won't match anything
  const search = page.getByRole('searchbox').first();
  await search.fill('xyznonexistent_query_that_matches_nothing_99999');

  // Wait for debounce
  await page.waitForTimeout(500);

  // Empty state message should be visible
  await expect(page.getByText(/aucun élément ne correspond/i)).toBeVisible({ timeout: 5000 });
});

test('library-errors — QuickEditDrawer save disabled when schedule is cleared', async ({
  page,
}) => {
  // The "Date invalide" path in QuickEditDrawer is a defence-in-depth guard
  // that cannot be triggered via the UI (datetime-local inputs only produce
  // valid ISO strings or empty). We verify the related constraint: the save
  // button is disabled when the schedule input is empty.
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const cards = page.locator('[data-testid^="calendar-card-"]');
  const cardCount = await cards.count();

  if (cardCount === 0) {
    test.skip(true, 'No calendar cards — cannot test QuickEditDrawer.');
    return;
  }

  // Double-click the first card to open the drawer
  await cards.first().dblclick();

  const drawer = page.locator('[data-testid="quick-edit-drawer"]');
  await expect(drawer).toBeVisible({ timeout: 5000 });

  // Clear the schedule input
  const scheduleInput = page.locator('[data-testid="quick-edit-schedule-input"]');
  await scheduleInput.fill('');

  // Save button should be disabled when schedule is empty
  const saveButton = page.locator('[data-testid="quick-edit-save"]');
  await expect(saveButton).toBeDisabled();
});
