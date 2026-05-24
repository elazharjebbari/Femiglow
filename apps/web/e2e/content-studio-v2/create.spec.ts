/**
 * Content Studio v2 — /create mode.
 *
 * Verifies the workspace mounts (Stepper + Intention form + Preview),
 * the format radios react, and the contextual "Sauvegarder" command
 * does NOT appear before a draft is selected (proves the conditional
 * useCommand registration works).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('create — workspace mounts with intention form + preview', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: /format de contenu/i })).toBeVisible();
});

test('create — format radio buttons are interactive', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);

  const reel = page.getByRole('radio', { name: /^reel/i }).first();
  await reel.click();
  await expect(reel).toHaveAttribute('aria-checked', 'true');
});

test('create — palette does not expose "Sauvegarder" without a draft', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible();
  // Save command is conditional on having a draft selected — fresh page has none.
  await expect(page.getByText(/sauvegarder le brouillon/i)).toHaveCount(0);
  await page.keyboard.press('Escape');
});
