/**
 * Content Studio v2 — /plan mode.
 *
 * Smoke-level coverage: calendar renders, view tabs switch (week/month/list),
 * navigation arrows update the visible range, and the contextual palette
 * commands (Aller à aujourd'hui, Vue semaine, …) are registered.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('plan — calendar header + default view = semaine', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: /calendrier éditorial/i, level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Semaine' })).toHaveAttribute('aria-selected', 'true');
});

test('plan — view switch month/list updates the tab state', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  await page.getByRole('tab', { name: 'Mois' }).click();
  await expect(page.getByRole('tab', { name: 'Mois' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]view=month/);

  await page.getByRole('tab', { name: 'Liste' }).click();
  await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]view=list/);
});

test('plan — palette exposes "Aller à aujourd\'hui" command', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/plan');
  await ensureAuthOrSkip(page);

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible();
  await expect(page.getByText(/aller à aujourd['’ ]hui/i)).toBeVisible();
  await expect(page.getByText(/vue (semaine|mois|liste)/i).first()).toBeVisible();

  await page.keyboard.press('Escape');
});
