/**
 * CS v2 portal background regression — ensure Radix Popover & Dialog content
 * rendered in portals get an opaque background. The original bug: tokens
 * were scoped to `.cs-v2-shell` only, so portals (which render under <body>)
 * resolved `background: var(--cs-bg-elevated)` to `transparent` and bled
 * through the underlying page.
 *
 * Fix: tokens.css now exposes the same `--cs-*` variables on `:root` as a
 * fallback. This spec guards the regression.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — portal backgrounds are opaque', () => {
  test('ModelPicker popover has a resolved non-transparent background', async ({ page }) => {
    await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Open the IntentionForm chat picker.
    await page.getByTestId('intention-form-model-picker').click();
    const popover = page.locator('[data-radix-popper-content-wrapper] [role="dialog"]');
    await expect(popover).toBeVisible();

    const bg = await popover.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // computedStyle returns either rgb()/rgba(); transparent → rgba(0,0,0,0).
    // We just want to ensure alpha > 0.
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
  });

  test('Schedule dialog has an opaque background', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Drive through to the publish step.
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Portal bg E2E.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer (un visuel|une vidéo) IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();
    await expect(page.getByText(/Draft validé/i)).toBeVisible({ timeout: 5_000 });
    void state;

    const trigger = page.getByRole('button', { name: /Options de publication/i });
    await expect(trigger).toBeEnabled({ timeout: 5_000 });
    await trigger.click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();

    const dialog = page.getByRole('dialog', { name: /Programmer la publication/i });
    await expect(dialog).toBeVisible();

    const bg = await dialog.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
  });
});
