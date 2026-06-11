/**
 * Content Studio v2 — /create error recovery tests.
 *
 * Uses `page.route()` to intercept API calls and simulate error conditions:
 *  - 429 budget exceeded on generate-visual
 *  - 500 server error on ideas endpoint
 *  - Invalid form submission (prompt too short)
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test.describe('create — error recovery', () => {
  test('validation error: prompt too short shows inline error', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Clear the prompt (which has a default) and set a short one (< 8 chars)
    const promptField = page.locator('textarea').first();
    await promptField.fill('abc');

    // Submit the form
    await page.getByRole('button', { name: /enregistrer l'idée/i }).click();

    // The zod schema enforces min(8); an inline error should appear
    // near the textarea (rendered as a <span> with the error message).
    await expect(page.locator('[aria-invalid="true"]')).toBeVisible({ timeout: 3000 });
  });

  test('server 500 on /ideas shows server error alert', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Intercept the ideas creation endpoint to return 500
    await page.route('**/api/admin/content-studio/ideas', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Erreur serveur inattendue' },
        }),
      }),
    );

    // Fill a valid prompt (>= 8 chars)
    const promptField = page.locator('textarea').first();
    await promptField.fill('Rituel FemiGlow pour des ongles lumineux et naturels');

    // Submit the form
    await page.getByRole('button', { name: /enregistrer l'idée/i }).click();

    // The server error should display in a role="alert" element
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('p[role="alert"]')).toContainText(/erreur/i);
  });

  test('generate-visual 429 budget error shows toast', async ({ page }) => {
    // Le bouton Générer est désormais désactivé tant qu'aucune variante n'est
    // sélectionnée (garde P2) : il faut dérouler idée → variante avant de
    // déclencher le 429 (même pattern que create-budget-exhaustion).
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Intercept the generate-visual endpoint to return 429
    await page.route('**/api/admin/content-studio/drafts/*/generate-visual', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'budget_exceeded', message: 'Budget IA quotidien épuisé.' },
        }),
      }),
    );

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.locator('textarea').first().fill('Rituel du soir pour un 429 budget.');
    await page.getByRole('button', { name: /enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    const genBtn = page.getByRole('button', { name: /Générer (un visuel|une vidéo) IA/i });
    await expect(genBtn).toBeEnabled({ timeout: 10_000 });
    await genBtn.click();
    // Sonner toast should show the budget error message
    await expect(page.getByText(/budget/i).first()).toBeVisible({ timeout: 5000 });
  });
});
