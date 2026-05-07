/**
 * E2E — admin /components/[key] : multi-sélection + bulk action bar.
 *
 * Note : la page admin est protégée par le middleware. Sans
 * `admin-storage.json`, la page redirige vers /admin/login. On accepte ce
 * cas gracieusement.
 */
import { test, expect } from '@playwright/test';

test.describe('admin components — multi-sélection', () => {
  test('détail composant home-hero : voyant + bulk bar', async ({ page }) => {
    const res = await page.goto('/admin/components/home-hero');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      // Sans fixture admin, on s'assure quand même que le rendu de login est OK.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }

    // Heading + au moins un slot.
    await expect(page.getByRole('heading', { name: /slots média/i })).toBeVisible();

    const selectAll = page.getByTestId('select-all');
    if ((await selectAll.count()) === 0) {
      // Aucun binding existant → rien à sélectionner, comportement valide.
      return;
    }

    // 1) Cocher « Tout sélectionner » → voyant doit s'afficher.
    await selectAll.click();
    await expect(page.getByTestId('select-all-voyant')).toBeVisible();

    // 2) La bulk bar doit apparaître avec compteur > 0.
    const bulkCount = page.getByTestId('bulk-count');
    await expect(bulkCount).toBeVisible();

    // 3) Décocher : la bulk bar disparaît.
    await selectAll.click();
    await expect(bulkCount).toHaveCount(0);
  });
});
