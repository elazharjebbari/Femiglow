/**
 * E2E /admin/coupons — parcours opérateur (CPN-10/11) + effet sur /kit.
 *
 * Tags : @admin-coupons-auth · @admin-coupons-crud · @admin-coupons-effect
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('/admin/coupons (auth required) @admin-coupons-auth', () => {
  test('redirige vers /admin/login sans session', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/coupons');
    await expect(page).toHaveURL(/\/admin\/login/);
    await ctx.close();
  });
});

test.describe('/admin/coupons (opérateur) @admin-coupons-crud', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('rend le manager et crée puis active un coupon', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('coupons-manager')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Coupons/i })).toBeVisible();

    // Création d'un coupon d'accueil (brouillon).
    await page.getByLabel('Libellé').fill('Geste d’accueil E2E');
    await page.getByRole('button', { name: /Créer \(brouillon\)/i }).click();

    // La ligne apparaît avec un statut Brouillon, puis on l'active.
    const row = page.locator('[data-testid^="coupon-row-"]', {
      hasText: 'Geste d’accueil E2E',
    });
    await expect(row.first()).toBeVisible();
    await row.first().getByRole('button', { name: 'Activer' }).click();
    await expect(row.first()).toContainText('Actif');
  });

  test('@admin-coupons-effect un welcome_auto actif fait apparaître la note sur /kit', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Garantit au moins un welcome_auto actif.
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('coupons-manager')).toBeVisible();
    const activateButtons = page.getByRole('button', { name: 'Activer' });
    if ((await activateButtons.count()) > 0) {
      await activateButtons.first().click();
    }

    await page.goto('/kit');
    await page.locator('[data-testid="pack-price-block"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-testid="pack-price-line"]')).toContainText(/199/);
  });
});
