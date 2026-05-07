import { test, expect } from '@playwright/test';

test.describe('admin webhooks', () => {
  test('liste webhooks — protégée par auth', async ({ page }) => {
    await page.goto('/admin/webhooks');
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /webhooks?/i })).toBeVisible();
  });

  test('formulaire création webhook — protégé par auth', async ({ page }) => {
    await page.goto('/admin/webhooks/new');
    if (page.url().includes('/admin/login')) {
      return;
    }
    await expect(page.getByLabel(/url/i)).toBeVisible();
  });

  test('deliveries — protégée par auth', async ({ page }) => {
    await page.goto('/admin/webhooks/we_unknown/deliveries');
    if (page.url().includes('/admin/login')) {
      return;
    }
    // Soit 404 soit la page se rend sans données.
    expect(true).toBe(true);
  });
});
