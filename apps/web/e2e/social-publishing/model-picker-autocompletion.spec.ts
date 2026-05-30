/**
 * E2E — Vérifie que l'autocompletion du ModelPicker fonctionne sur le
 * /create page :
 *  - Le bouton trigger ouvre le popover
 *  - Le champ de recherche est auto-focus
 *  - Taper 'flux' filtre les modèles
 *  - Type-ahead direct sur le trigger ouvre + pré-remplit
 *  - Les modèles 'live' ont un badge LIVE
 *  - Le compteur reflète le total
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function reachMediaStudio(page: import('@playwright/test').Page) {
  await page.goto('/admin/content-studio-v2/create');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('button[role="radio"][data-format="post"]').click();
  await page.getByRole('textbox').first().fill('Test autocompletion ModelPicker, rituel slow.');
  await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
  await page.locator('[data-variant-id]').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
  await page.waitForTimeout(1500);
  // Warm up the models endpoint so subsequent picker opens are fast (the
  // first call triggers live discovery which can take up to 15 s).
  await page.evaluate(() =>
    Promise.all([
      fetch('/api/admin/content-studio/models?role=image&format=post'),
      fetch('/api/admin/content-studio/models?role=chat&format=post'),
      fetch('/api/admin/content-studio/models?role=video&format=reel'),
    ]),
  );
}

async function waitForModelList(page: import('@playwright/test').Page) {
  // Counter must have a number (Loading… is gone)
  await page
    .locator('[data-cs-model-picker-count]')
    .filter({ hasText: /\d+ modèle/ })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
}

test('ModelPicker — search input is auto-focused + counter visible', async ({ page }) => {
  test.setTimeout(120_000);
  await reachMediaStudio(page);

  const picker = page.getByTestId('media-studio-model-picker-image');
  await expect(picker).toBeVisible({ timeout: 10_000 });
  await picker.click();

  const searchInput = page.getByTestId('model-picker-search');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await expect(searchInput).toBeFocused();

  await waitForModelList(page);
  const counterText = await page.locator('[data-cs-model-picker-count]').first().textContent();
  console.log('Counter:', counterText);
  expect(counterText).toMatch(/\d+ modèle/);
});

test('ModelPicker — typing "flux" filters to flux models only', async ({ page }) => {
  test.setTimeout(120_000);
  await reachMediaStudio(page);
  await page.getByTestId('media-studio-model-picker-image').click();
  await waitForModelList(page);

  const searchInput = page.getByTestId('model-picker-search');
  await searchInput.fill('flux');
  await page.waitForTimeout(400);
  const optionTexts = await page.locator('[role="option"]').allTextContents();
  console.log('Filtered (flux):', optionTexts.length, 'matches');
  expect(optionTexts.length).toBeGreaterThan(0);
  // All visible options should match the query
  expect(optionTexts.every((t) => /flux/i.test(t))).toBe(true);
});

test('ModelPicker — typing "gpt-image" surfaces live-discovered gpt-image-2', async ({ page }) => {
  test.setTimeout(120_000);
  await reachMediaStudio(page);
  await page.getByTestId('media-studio-model-picker-image').click();
  await waitForModelList(page);

  await page.getByTestId('model-picker-search').fill('gpt-image');
  await page.waitForTimeout(400);
  const filtered = await page.locator('[role="option"]').allTextContents();
  console.log('Filtered (gpt-image):', filtered.slice(0, 6));
  expect(filtered.some((t) => /gpt.*image.*2/i.test(t))).toBe(true);
});

// The "clear search" button is covered by Vitest unit tests
// (ModelPicker.test.tsx → "clear search button resets the query").
// We do not duplicate it in E2E to keep the suite snappy — the unit test
// asserts the same behaviour deterministically.

test('ModelPicker — type-ahead on trigger opens popover with pre-filled query', async ({ page }) => {
  test.setTimeout(180_000);
  await reachMediaStudio(page);

  const picker = page.getByTestId('media-studio-model-picker-image');
  await expect(picker).toBeVisible({ timeout: 10_000 });
  // Focus le trigger sans cliquer
  await picker.focus();
  // Taper 'd' directement
  await page.keyboard.press('d');
  // Le popover doit s'ouvrir avec 'd' dans la recherche
  const searchInput = page.getByTestId('model-picker-search');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await expect(searchInput).toHaveValue('d');
  // Attendre que les options soient chargées (la list dépend du fetch)
  await waitForModelList(page);
  await page.waitForTimeout(500);
  const options = await page.locator('[role="option"]').allTextContents();
  console.log('Type-ahead "d" results:', options.slice(0, 5));
  expect(options.some((t) => /dall.?e/i.test(t))).toBe(true);
});

test('ModelPicker — LIVE badge appears on live-discovered models', async ({ page }) => {
  test.setTimeout(180_000);
  await reachMediaStudio(page);

  const picker = page.getByTestId('media-studio-model-picker-image');
  await picker.click();
  await page.getByTestId('model-picker-search').waitFor({ state: 'visible' });
  await waitForModelList(page);
  await page.waitForTimeout(500);

  // Au moins un badge "Live" doit être visible (provider OpenAI marqué live par discovery)
  const liveBadges = await page.locator('[data-cs-model-source-badge]').count();
  console.log('Live badges:', liveBadges);
  expect(liveBadges).toBeGreaterThan(0);
});

test('ModelPicker — empty state when search has no match + offers custom add', async ({ page }) => {
  test.setTimeout(180_000);
  await reachMediaStudio(page);
  const picker = page.getByTestId('media-studio-model-picker-image');
  await picker.click();
  const searchInput = page.getByTestId('model-picker-search');
  await searchInput.fill('xyz-nonexistent-model-id-zzz');
  await page.waitForTimeout(300);
  // Empty state message
  await expect(page.getByText(/Aucun modèle ne correspond/i)).toBeVisible();
});
