/**
 * E2E Playwright — pages Poka-Yoke GTM.
 *
 * Tolérant à l'absence de session admin (redirige vers /admin/login).
 * cf. docs/gtm-poka-yoke/70-tests/01-strategy.md
 */
import { test, expect } from '@playwright/test';

test.describe('admin tracking GTM Poka-Yoke', () => {
  test('page /admin/tracking/gtm/sync-status — protégée par auth', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/sync-status');
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /sync status/i })).toBeVisible();
  });

  test('page sync-status — affiche le badge statut global', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/sync-status');
    if (page.url().includes('/admin/login')) return;
    const badge = page.getByTestId('global-status-badge');
    await expect(badge).toBeVisible();
  });

  test('page sync-status — bouton refresh fonctionnel', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/sync-status');
    if (page.url().includes('/admin/login')) return;
    const refresh = page.getByTestId('btn-refresh');
    await expect(refresh).toBeVisible();
    await refresh.click();
    await expect(refresh).toBeVisible();
  });

  test('page /admin/tracking/gtm/validate-pair — wizard step 1 visible', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/validate-pair');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByTestId('validate-pair-wizard')).toBeVisible();
    await expect(page.getByTestId('config-dropzone')).toBeAttached();
  });

  test('menu — onglets gtm-sync et gtm-validate présents', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/sync-status');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByRole('link', { name: /^gtm sync$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /valider import gtm/i })).toBeVisible();
  });
});
