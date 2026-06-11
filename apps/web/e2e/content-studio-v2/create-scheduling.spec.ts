/**
 * CS v2 create-audit Phase 7 — schedule dialog UX.
 *
 * Covers: preset buttons (+1h / Demain 9h / Lundi 14h), timezone label,
 * and the POST /schedule call shape.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — schedule presets + dialog', () => {
  async function drivePathUntilPublishEnabled(
    page: import('@playwright/test').Page,
    state: Awaited<ReturnType<typeof registerCreateMocks>>,
  ) {
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E pour scheduling.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
    await page.getByRole('button', { name: /Générer (un visuel|une vidéo) IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('approve-draft-button').click();
    await expect(page.getByText(/Draft validé/i)).toBeVisible({ timeout: 5_000 });
    void state;
  }

  test('opens the schedule dialog, shows presets + timezone label', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await drivePathUntilPublishEnabled(page, state);

    const trigger = page.getByRole('button', { name: /Options de publication/i });
    await expect(trigger).toBeEnabled({ timeout: 5_000 });
    await trigger.click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();

    await expect(page.getByTestId('schedule-preset-1h')).toBeVisible();
    await expect(page.getByTestId('schedule-preset-tomorrow-9')).toBeVisible();
    await expect(page.getByTestId('schedule-preset-monday-14')).toBeVisible();
    const tz = page.getByTestId('schedule-timezone-label');
    await expect(tz).toBeVisible();
    await expect(tz).toContainText(/Fuseau/i);
  });

  test('clicking +1h sets scheduledAt about one hour from now', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await drivePathUntilPublishEnabled(page, state);

    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();
    await page.getByTestId('schedule-preset-1h').click();

    const value = await page.locator('input[type="datetime-local"]').inputValue();
    const target = new Date(value);
    const delta = target.getTime() - Date.now();
    // 30 min .. 75 min (5-min rounded boundary)
    expect(delta).toBeGreaterThan(30 * 60 * 1000);
    expect(delta).toBeLessThan(75 * 60 * 1000);
  });

  test('confirming schedule fires POST /posts/:id/schedule', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await drivePathUntilPublishEnabled(page, state);

    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();
    await page.getByTestId('schedule-preset-1h').click();
    await page.getByRole('button', { name: /^Programmer$/i }).click();
    await expect(page.getByText(/Publication programmée/i)).toBeVisible({ timeout: 5_000 });
    expect(state.publishScheduleCalled).toBe(true);
  });

  test('schedule dialog renders the G12 confirm preview', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await drivePathUntilPublishEnabled(page, state);

    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Programmer/i }).click();

    await expect(page.getByTestId('publish-confirm-preview')).toBeVisible();
  });
});
