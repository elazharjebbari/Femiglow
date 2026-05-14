/**
 * E2E — historique d'une page légale.
 *
 * Pré-requis : au moins une page publiée avec ≥ 1 version historisée.
 * Skip propre si pas trouvé.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) test.skip();
}

test.describe('admin legal — history drawer', () => {
  test('bouton Historique ouvre un dialog avec aria-modal', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    const firstEdit = page.getByRole('link', { name: /Éditer/ }).first();
    if (!(await firstEdit.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstEdit.click();
    await page.waitForURL(/\/admin\/legal\/[^/]+\/edit/);

    await page.getByRole('button', { name: /Historique/ }).click();
    const dialog = page.getByRole('dialog', { name: /Historique/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('fermer le drawer avec ✕', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    const firstEdit = page.getByRole('link', { name: /Éditer/ }).first();
    if (!(await firstEdit.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstEdit.click();
    await page.waitForURL(/\/admin\/legal\/[^/]+\/edit/);

    await page.getByRole('button', { name: /Historique/ }).click();
    await page.getByLabel(/Fermer l'historique/).click();
    await expect(page.getByRole('dialog', { name: /Historique/i })).not.toBeVisible();
  });

  test('si page a des versions, on les voit listées', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    const firstEdit = page.getByRole('link', { name: /Éditer/ }).first();
    if (!(await firstEdit.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstEdit.click();
    await page.waitForURL(/\/admin\/legal\/[^/]+\/edit/);
    await page.getByRole('button', { name: /Historique/ }).click();

    // Soit on a au moins 1 version (v1, v2...), soit on a le message
    // "Aucune version historisée". Les 2 cas sont valides.
    const dialog = page.getByRole('dialog');
    const hasVersions = await dialog
      .locator('text=/^v\\d+/')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await dialog
      .locator('text=Aucune version historisée')
      .isVisible()
      .catch(() => false);
    expect(hasVersions || hasEmpty).toBe(true);
  });
});
