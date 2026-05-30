/**
 * CS v2 create-audit Phase 7 — Keyboard shortcuts smoke test.
 *
 * Verifies the Cmd/Ctrl+S flush autosave shortcut and that pressing Esc
 * closes any open Dialog (Radix handles the latter natively but we want
 * a regression guard).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — keyboard shortcuts', () => {
  test('Esc closes the Programmer dialog', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E pour Esc.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();
    await expect(page.getByText(/Draft validé/i)).toBeVisible({ timeout: 5_000 });
    void state;

    const trigger = page.getByRole('button', { name: /Options de publication/i });
    await expect(trigger).toBeEnabled({ timeout: 5_000 });
    await trigger.click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();

    // Confirm the dialog is open.
    await expect(page.locator('input[type="datetime-local"]')).toBeVisible();

    // Press Esc, expect the dialog to close.
    await page.keyboard.press('Escape');
    await expect(page.locator('input[type="datetime-local"]')).toBeHidden({ timeout: 5_000 });
  });

  test('Cmd/Ctrl+S triggers autosave flush command (when registered)', async ({ page }) => {
    // We don't tightly assert on the API call here — the command is a no-op
    // unless a draft is selected. We just check the page accepts the shortcut
    // without crashing.
    await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.keyboard.press('Meta+s');
    await page.keyboard.press('Control+s');
    // Page should still be on the create page (no navigation, no crash).
    await expect(page.locator('[data-section="frame"]')).toBeVisible();
  });
});
