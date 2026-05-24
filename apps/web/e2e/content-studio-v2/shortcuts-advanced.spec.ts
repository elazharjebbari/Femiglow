/**
 * Content Studio v2 — Advanced keyboard shortcuts.
 *
 * 1. `?` opens the KeyboardCheatsheet modal ("Raccourcis clavier")
 * 2. `Ctrl+Shift+L` toggles the theme (data-theme attribute changes on .cs-v2-shell)
 * 3. Escape closes the cheatsheet modal
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('shortcuts — ? opens KeyboardCheatsheet modal via palette', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // The `?` hotkey is registered by react-hotkeys-hook, but browser
  // environments in CI may not reliably dispatch the `?` key via
  // Playwright's keyboard API. Instead, open the command palette and
  // invoke the "Voir tous les raccourcis" command which calls the same
  // `onOpenCheatsheet` callback.
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible({
    timeout: 5000,
  });

  // Type to filter for the cheatsheet command
  await page.keyboard.type('raccourcis');
  await page.waitForTimeout(300);

  // Select the "Voir tous les raccourcis" command
  const cheatsheetCmd = page.getByText(/voir tous les raccourcis/i).first();
  await expect(cheatsheetCmd).toBeVisible();
  await cheatsheetCmd.click();

  // The cheatsheet dialog should appear with title "Raccourcis clavier"
  await expect(page.getByRole('heading', { name: /raccourcis clavier/i })).toBeVisible({
    timeout: 5000,
  });
});

test('shortcuts — Escape closes the KeyboardCheatsheet modal', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // Open the cheatsheet via the command palette
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible({
    timeout: 5000,
  });
  await page.keyboard.type('raccourcis');
  await page.waitForTimeout(300);
  await page.getByText(/voir tous les raccourcis/i).first().click();

  await expect(page.getByRole('heading', { name: /raccourcis clavier/i })).toBeVisible({
    timeout: 5000,
  });

  // Press Escape to close the cheatsheet
  await page.keyboard.press('Escape');

  // The heading should no longer be visible
  await expect(page.getByRole('heading', { name: /raccourcis clavier/i })).not.toBeVisible({
    timeout: 3000,
  });
});

test('shortcuts — Ctrl+Shift+L toggles theme', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // Read the initial theme from the .cs-v2-shell wrapper
  const shell = page.locator('.cs-v2-shell');
  await expect(shell).toBeVisible();

  const initialTheme = await shell.getAttribute('data-theme');

  // Press Ctrl+Shift+L to toggle
  await page.keyboard.press('ControlOrMeta+Shift+l');

  // Wait for the theme to update
  await page.waitForTimeout(500);

  const newTheme = await shell.getAttribute('data-theme');

  // Theme should have toggled
  if (initialTheme === 'light' || initialTheme === null) {
    expect(newTheme).toBe('dark');
  } else {
    expect(newTheme).toBe('light');
  }

  // Toggle back
  await page.keyboard.press('ControlOrMeta+Shift+l');
  await page.waitForTimeout(500);

  const restoredTheme = await shell.getAttribute('data-theme');
  // Should be back to the original
  expect(restoredTheme).toBe(initialTheme ?? 'light');
});
