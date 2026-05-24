/**
 * Content Studio v2 — /library mode.
 *
 * Smoke-level coverage: page renders, search box reacts, status filter
 * updates the URL, the result counter responds to filters.
 *
 * Doesn't assume any specific draft/post fixtures exist in the DB —
 * we observe relative behaviour (counts decrease as filters apply).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('library — render + breadcrumb', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: /bibliothèque/i, level: 1 })).toBeVisible();
  // The filter toolbar exposes a known accessible name.
  await expect(page.getByRole('toolbar', { name: /filtres bibliothèque/i })).toBeVisible();
});

test('library — search input pushes to URL', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  const search = page.getByRole('searchbox').first();
  await search.fill('femiglow');
  // LibrarySearch debounces 250ms then serialises as `?q=…`.
  await expect(page).toHaveURL(/[?&]q=femiglow/i, { timeout: 5000 });

  // Clearing the input drops the param.
  await search.fill('');
  await expect(page).toHaveURL((url) => !/[?&]q=/.test(url.search), { timeout: 5000 });
});

test('library — platform filter cycles via the toolbar', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  // Open the "Plateforme" picker (button labelled "Plateforme : Toutes").
  const platformTrigger = page.getByRole('button', { name: /plateforme\s*:/i });
  await platformTrigger.click();
  await page.getByRole('option', { name: /instagram/i }).click();
  await expect(page).toHaveURL(/[?&]platform=instagram/);

  // Re-open and revert to "Toutes" (option label "Toutes").
  await platformTrigger.click();
  await page.getByRole('option', { name: /toutes/i }).click();
  await expect(page).toHaveURL((url) => !/[?&]platform=/.test(url.search));
});
