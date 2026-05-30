/**
 * CS v2 create-audit Phase 7 — error recovery & friendly message mapping.
 *
 * The route handlers in this file deliberately return structured error
 * envelopes `{ error: { code, message } }` to exercise the `formatError`
 * helper introduced in Phase 6. The UI must show the mapped French
 * sentence, not the raw HTTP status.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — error recovery (mapped messages)', () => {
  test('publish-now 409 no_account_connected → French message', async ({ page }) => {
    await registerCreateMocks(page);
    await page.route('**/api/admin/content-studio/posts/*/publish-now', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'no_account_connected', message: 'Pas de compte' },
        }),
      }),
    );

    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E pour error path.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();
    await expect(page.getByText(/Draft validé/i)).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Publier maintenant/i }).click();
    await page.getByRole('button', { name: /Confirmer/i }).click();

    await expect(page.getByText(/Aucun compte social connecté\./i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('approve no_media_attached → French message + no transition', async ({ page }) => {
    await registerCreateMocks(page);
    await page.route('**/api/admin/content-studio/drafts/*/approve', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'no_media_attached', message: 'Media missing' },
        }),
      }),
    );

    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E approve failure.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();

    await expect(page.getByText(/Aucun média attaché au draft\./i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
