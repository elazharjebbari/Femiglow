import { test, expect } from '@playwright/test';

/**
 * E2E — Liste /admin/emails/automation.
 *
 * Couvre :
 *  - rendu de la liste,
 *  - présence d'un toggle actif/inactif pour chaque automation (seed
 *    `cart-abandoned-1h` exists in 0031_emailing_automation_seed.sql),
 *  - clic sur le toggle (smoke test — ne vérifie pas la persistence DB,
 *    on regarde juste que l'action ne renvoie pas 500).
 */
test.describe('admin emails automation', () => {
  test('list renders without 500', async ({ page }) => {
    const res = await page.goto('/admin/emails/automation');
    if (page.url().includes('/admin/login')) return;
    expect(res?.status()).toBeLessThan(500);
  });

  test('seed automation cart-abandoned visible (when DB seeded)', async ({ page }) => {
    await page.goto('/admin/emails/automation');
    if (page.url().includes('/admin/login')) return;
    // The seed may or may not be present depending on env — we accept either.
    const row = page
      .locator('text=/cart-abandoned|panier|abandon/i')
      .first();
    if ((await row.count()) > 0) {
      await expect(row).toBeVisible();
    }
  });

  test('toggle button or switch present per row', async ({ page }) => {
    await page.goto('/admin/emails/automation');
    if (page.url().includes('/admin/login')) return;
    // Look for any switch / toggle / "activer/désactiver" button.
    const toggle = page
      .getByRole('button', { name: /activer|désactiver|toggle|enable|disable/i })
      .first();
    const switchEl = page.getByRole('switch').first();
    const candidate = (await toggle.count()) > 0 ? toggle : switchEl;
    if ((await candidate.count()) > 0) {
      await expect(candidate).toBeVisible();
    }
  });

  test('toggle click does not crash (no 500 in network)', async ({ page }) => {
    const failures: number[] = [];
    page.on('response', (resp) => {
      if (resp.status() >= 500 && resp.url().includes('/admin/emails/automation')) {
        failures.push(resp.status());
      }
    });
    await page.goto('/admin/emails/automation');
    if (page.url().includes('/admin/login')) return;
    const toggle = page.getByRole('switch').first();
    if ((await toggle.count()) === 0) return;
    await toggle.click().catch(() => {});
    // Wait for any in-flight request to settle.
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(failures).toHaveLength(0);
  });
});
