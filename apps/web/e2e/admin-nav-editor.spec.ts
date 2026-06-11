/**
 * N11 — E2E (best-effort) : éditeur de navigation admin.
 *
 * /admin/settings/navigation rend <NavEditor/> : table d'items éditable, dont
 * la ligne « coupons ». On vérifie la visibilité et la structure (pas de mutation).
 * Tag : @admin-nav-editor
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('/admin/settings/navigation — NavEditor @admin-nav-editor', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('N11-E001 l’éditeur de nav est visible avec sa table d’items', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/navigation');
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();
    await expect(grid).toContainText('Key');
    await expect(grid).toContainText('Label');
    await expect(grid).toContainText('Href');
  });

  test('N11-E002 l’éditeur expose des lignes d’items éditables', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/navigation');
    // Au moins une ligne d'item (input clé éditable) + footer « N items ».
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('tbody tr').first()).toBeVisible();
    await expect(page.getByText(/\d+ items/)).toBeVisible();
    // NB (dette documentée) : l'éditeur lit la config nav PERSISTÉE (DB), qui
    // peut précéder l'ajout de l'onglet Coupons (AdminShell rend une liste codée
    // en dur, découplée de la config). La présence de « coupons » dans navDefault
    // est vérifiée en unitaire (N05-U004).
  });
});
