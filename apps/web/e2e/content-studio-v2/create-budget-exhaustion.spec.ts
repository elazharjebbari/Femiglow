/**
 * CS v2 create-audit Phase 7 — budget exhaustion error mapping.
 *
 * When the daily budget is exceeded, /ideas/:id/generate returns 402 with
 * `error.code = 'budget_exceeded'`. The UI should surface the French
 * mapped message and keep the user on the Cadrer step.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — budget exhaustion', () => {
  test('generate budget 402 keeps the user on Cadrer + no variants render', async ({ page }) => {
    await registerCreateMocks(page);
    // Override the generate route to return a 402 envelope.
    await page.route('**/api/admin/content-studio/ideas/*/generate', (route) =>
      route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'budget_exceeded', message: 'Budget IA quotidien atteint' },
        }),
      }),
    );

    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E pour 402.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    // No variants should render.
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-variant-id]')).toHaveCount(0);

    // The Cadrer step should remain current (no auto-advance from a failed
    // generation call).
    await expect(
      page.locator('button[data-step="frame"][aria-current="step"]'),
    ).toBeVisible();
  });

  test('generate-visual budget 402 → mapped error in toast', async ({ page }) => {
    await registerCreateMocks(page);
    await page.route('**/api/admin/content-studio/drafts/*/generate-visual', (route) =>
      route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'budget_exceeded', message: 'Budget atteint' },
        }),
      }),
    );

    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E avant blocage visuel.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();

    // MediaStudio surfaces a toast with the server message.
    await expect(page.getByText(/Budget atteint/i)).toBeVisible({ timeout: 5_000 });
  });
});
