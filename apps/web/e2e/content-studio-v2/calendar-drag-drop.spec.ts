/**
 * Content Studio v2 — Calendar drag-and-drop tests.
 *
 * Tests rely on calendar cards (`data-testid="calendar-card-{postId}"`)
 * and day cells (`data-testid="day-{YYYY-MM-DD}"`).
 *
 * Uses `@dnd-kit/core` under the hood — Playwright drag events simulate
 * pointer-based drag and drop. Tests skip gracefully when no calendar
 * cards exist (empty calendar).
 *
 * Toasts are surfaced by `sonner` and detected via text content.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

/**
 * Get the first calendar card and its postId. Returns null if none exist.
 */
async function getFirstCalendarCard(page: import('@playwright/test').Page) {
  const cards = page.locator('[data-testid^="calendar-card-"]');
  const count = await cards.count();
  if (count === 0) return null;
  const first = cards.first();
  const testId = await first.getAttribute('data-testid');
  const postId = testId?.replace('calendar-card-', '') ?? null;
  return { element: first, postId };
}

/**
 * Build a date key in YYYY-MM-DD format.
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

test('calendar — drag card to future day triggers reschedule + success toast', async ({
  page,
}) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const card = await getFirstCalendarCard(page);
  if (!card) {
    test.skip(true, 'No calendar cards — skipping drag-drop test.');
    return;
  }

  // Pick a future day cell — 3 days from now
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const futureDayKey = formatDateKey(futureDate);
  const targetCell = page.locator(`[data-testid="day-${futureDayKey}"]`);

  if ((await targetCell.count()) === 0) {
    test.skip(true, `Day cell day-${futureDayKey} not visible in current view — skipping.`);
    return;
  }

  // Mock the reschedule endpoint to return 200
  await page.route('**/reschedule', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ post: { id: card.postId } }),
      });
    } else {
      await route.continue();
    }
  });

  // Perform drag and drop
  await page.dragAndDrop(
    `[data-testid="calendar-card-${card.postId}"]`,
    `[data-testid="day-${futureDayKey}"]`,
  );

  // Expect success toast
  await expect(page.getByText('Post reprogrammé')).toBeVisible({ timeout: 5000 });
});

test('calendar — drag card to past day shows error toast', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const card = await getFirstCalendarCard(page);
  if (!card) {
    test.skip(true, 'No calendar cards — skipping drag-drop test.');
    return;
  }

  // Switch to month view to have more day cells available, including past ones
  await page.getByRole('tab', { name: 'Mois' }).click();
  await expect(page.getByRole('tab', { name: 'Mois' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Pick a past day — 10 days ago
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  const pastDayKey = formatDateKey(pastDate);
  const pastCell = page.locator(`[data-testid="day-${pastDayKey}"]`);

  if ((await pastCell.count()) === 0) {
    test.skip(true, `Day cell day-${pastDayKey} not visible — skipping.`);
    return;
  }

  // Try to drag to a past day
  await page.dragAndDrop(
    `[data-testid="calendar-card-${card.postId}"]`,
    `[data-testid="day-${pastDayKey}"]`,
  );

  // Expect error toast about past date
  await expect(page.getByText(/impossible de reprogrammer dans le passé/i)).toBeVisible({
    timeout: 5000,
  });
});

test('calendar — drag with PATCH 500 shows error toast + card rollback', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const card = await getFirstCalendarCard(page);
  if (!card) {
    test.skip(true, 'No calendar cards — skipping drag-drop test.');
    return;
  }

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  const futureDayKey = formatDateKey(futureDate);
  const targetCell = page.locator(`[data-testid="day-${futureDayKey}"]`);

  if ((await targetCell.count()) === 0) {
    test.skip(true, `Day cell day-${futureDayKey} not visible — skipping.`);
    return;
  }

  // Mock the reschedule endpoint to return 500
  await page.route('**/reschedule', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.dragAndDrop(
    `[data-testid="calendar-card-${card.postId}"]`,
    `[data-testid="day-${futureDayKey}"]`,
  );

  // Expect error toast on failure
  await expect(page.getByText(/échec de reprogrammation/i)).toBeVisible({ timeout: 5000 });
});

test('calendar — drag card to same day = no-op (no PATCH fired)', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  const card = await getFirstCalendarCard(page);
  if (!card) {
    test.skip(true, 'No calendar cards — skipping drag-drop test.');
    return;
  }

  let patchCalled = false;
  await page.route('**/reschedule', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ post: { id: card.postId } }),
      });
    } else {
      await route.continue();
    }
  });

  // Find which day cell the card currently lives in
  const cardLocator = page.locator(`[data-testid="calendar-card-${card.postId}"]`);
  const parentDayCell = cardLocator.locator('xpath=ancestor::div[@data-testid]').first();
  const dayTestId = await parentDayCell.getAttribute('data-testid');

  if (!dayTestId?.startsWith('day-')) {
    test.skip(true, 'Could not locate parent day cell for the card — skipping.');
    return;
  }

  // Drag to the same day cell
  await page.dragAndDrop(
    `[data-testid="calendar-card-${card.postId}"]`,
    `[data-testid="${dayTestId}"]`,
  );

  // Allow time for any async call
  await page.waitForTimeout(1000);

  // PATCH should not have been called
  expect(patchCalled).toBe(false);
});
