/**
 * N10 — E2E parcours opérateur : onglet Coupons dans la nav admin.
 *
 * login (storageState) → /admin/coupons → l'onglet Coupons est surligné →
 * cliquer Tableau de bord → l'actif bascule (Coupons perd aria-current).
 * Tag : @admin-nav-coupons
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('/admin — onglet Coupons @admin-nav-coupons', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('N10-E001 onglet Coupons présent et surligné sur /admin/coupons', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/coupons');
    const tab = page.getByTestId('admin-nav-coupons');
    await expect(tab).toBeVisible();
    await expect(tab).toHaveText('Coupons');
    await expect(tab).toHaveAttribute('href', '/admin/coupons');
    await expect(tab).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('coupons-manager')).toBeVisible();
  });

  test('N10-E002 navigation : cliquer un autre onglet bascule l’actif', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('admin-nav-coupons')).toHaveAttribute('aria-current', 'page');
    // Navigation + attente conjointe (le serveur dev peut compiler /admin à la volée).
    await Promise.all([
      page.waitForURL(/\/admin(\/)?$/, { timeout: 60_000 }),
      page.getByTestId('admin-nav-dashboard').click(),
    ]);
    await expect(page.getByTestId('admin-nav-dashboard')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('admin-nav-coupons')).not.toHaveAttribute('aria-current', 'page');
  });
  // NB: la garde d'auth (sans session → /admin/login) est déjà couverte par
  // e2e/admin-coupons.spec.ts (@admin-coupons-auth) ; non dupliquée ici.
});
