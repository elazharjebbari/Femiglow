import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — step progression', () => {
  test('stepper advances frame → generate → visual → validate', async ({ page }) => {
    await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Initial state — Cadrer active.
    await expect(page.locator('button[data-step="frame"][aria-current="step"]')).toBeVisible();
    await expect(page.locator('button[data-step="visual"]')).toHaveAttribute('aria-disabled', 'true');

    // Create idea → drafts arrive → step=Générer active.
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Une intention pour passer step 1.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('button[data-step="generate"][aria-current="step"]')).toBeVisible();

    // Choose a variant → auto-review puts draft in needs_review → step=Visuel.
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await expect(page.locator('button[data-step="visual"][aria-current="step"]')).toBeVisible({
      timeout: 5_000,
    });

    // Generate visual + approve → step=Valider.
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();
    await expect(page.locator('button[data-step="validate"][aria-current="step"]')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('future steps show tooltip explaining what to do first', async ({ page }) => {
    await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    const future = page.locator('button[data-step="visual"]');
    const title = await future.getAttribute('title');
    expect(title).toBeTruthy();
    expect(title).toMatch(/Complétez/i);
  });
});
