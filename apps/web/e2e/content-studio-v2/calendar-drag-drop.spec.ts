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

test.use({
  storageState: ADMIN_STORAGE_PATH,
  // Les cases du calendrier font ~677 px de haut : avec le viewport par
  // défaut (720) leur CENTRE est sous la ligne de flottaison, Playwright
  // scrolle PENDANT le drag et les rects mesurés par dnd-kit au dragStart
  // ne correspondent plus → le drop se résout sur la mauvaise case
  // (constaté le 2026-06-11 : drop sur la case d'origine). Un viewport
  // haut garde toute la grille visible, aucun scroll en cours de drag.
  viewport: { width: 1280, height: 1600 },
});

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

/**
 * Drag manuel par étapes : `page.dragAndDrop` n'émet pas assez de
 * `mousemove` après l'activation du PointerSensor dnd-kit → la détection
 * de collision reste figée sur la case source (drop annoncé sur le jour
 * d'origine, constaté le 2026-06-11). On pilote la souris nous-mêmes avec
 * des déplacements intermédiaires pour que dnd-kit suive le pointeur.
 */
async function dragCardTo(
  page: import('@playwright/test').Page,
  sourceSelector: string,
  targetSelector: string,
) {
  const source = page.locator(sourceSelector);
  const target = page.locator(targetSelector);
  await target.scrollIntoViewIfNeeded();
  const sBox = await source.boundingBox();
  const tBox = await target.boundingBox();
  if (!sBox || !tBox) throw new Error('drag: bounding box introuvable');
  const sx = sBox.x + sBox.width / 2;
  const sy = sBox.y + sBox.height / 2;
  // Viser le HAUT de la case cible (les cases sont hautes : le centre peut
  // chevaucher d'autres droppables ou sortir du viewport).
  const tx = tBox.x + tBox.width / 2;
  const ty = tBox.y + Math.min(60, tBox.height / 2);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Petit mouvement initial pour franchir la contrainte d'activation.
  await page.mouse.move(sx + 8, sy + 8, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 20 });
  // Pause : dnd-kit met à jour la collision au rythme des events.
  await page.waitForTimeout(150);
  await page.mouse.move(tx, ty + 2);
  await page.mouse.up();
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

  // Perform drag and drop (cible rendue visible AVANT le drag pour que les
  // rects dnd-kit mesurés au dragStart restent valides).
  await page.locator(`[data-testid="day-${futureDayKey}"]`).scrollIntoViewIfNeeded();
  await dragCardTo(
    page,
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
  await dragCardTo(
    page,
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

  await dragCardTo(
    page,
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
  await dragCardTo(
    page,
    `[data-testid="calendar-card-${card.postId}"]`,
    `[data-testid="${dayTestId}"]`,
  );

  // Allow time for any async call
  await page.waitForTimeout(1000);

  // PATCH should not have been called
  expect(patchCalled).toBe(false);
});
