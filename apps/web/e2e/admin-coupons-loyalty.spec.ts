/**
 * F16 — E2E parcours opérateur : créer → activer → effet /kit → codes émis.
 *
 * Étend admin-coupons.spec.ts (ne le duplique pas) : ajoute la vérification de
 * la section « Codes de fidélité émis » (téléphone MASQUÉ) et la parité prix.
 * Tag : @admin-coupons-loyalty
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('/admin/coupons — fidélité opérateur @admin-coupons-loyalty', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('F16-E001 créer un brouillon puis l’activer (badge Actif)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('coupons-manager')).toBeVisible();

    const label = `Geste fidélité ${Date.now()}`;
    await page.getByLabel('Libellé').fill(label);
    await page.getByRole('button', { name: /Créer \(brouillon\)/i }).click();

    const row = page.locator('[data-testid^="coupon-row-"]', { hasText: label }).first();
    // create → POST → refresh GET → re-render : marge sur page admin chargée.
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Activer' }).click();
    await expect(row).toContainText('Actif', { timeout: 20_000 });
  });

  test('F16-E002 INV-PRICE : parité 199 MAD sur /kit', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/kit', { timeout: 45_000 });
    await page.locator('[data-testid="pack-price-block"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-testid="pack-price-line"]').first()).toContainText(/199/);
  });

  test('F16-E003 INV-PII : la section codes émis masque le téléphone', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('coupons-grants-section')).toBeVisible();
    await page.getByRole('button', { name: /Charger|Rafraîchir/ }).click();

    const table = page.getByTestId('coupons-grants-table');
    // La table peut être vide selon le seed : on n'asserte le masquage que s'il
    // existe au moins une ligne.
    if ((await table.count()) > 0) {
      const rows = page.locator('[data-testid^="grant-row-"]');
      const n = await rows.count();
      for (let i = 0; i < n; i += 1) {
        const phoneCell = rows.nth(i).locator('td').nth(1);
        const txt = (await phoneCell.textContent()) ?? '';
        // INV-PII : aucun numéro de 6+ chiffres consécutifs en clair.
        expect(/\d{6,}/.test(txt)).toBe(false);
      }
    }
  });
});
