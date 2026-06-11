import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — mock video flow', () => {
  test('reel format defaults to video kind and produces a playable MP4', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Select reel + create idea
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Reel slow ritual lumière chaude.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    // The Vidéo toggle should be the active radio for reel.
    const videoToggle = page.locator('button[role="radio"][data-cs-kind="video"]');
    await expect(videoToggle).toBeVisible();
    await expect(videoToggle).toHaveAttribute('aria-checked', 'true');

    // The role=video ModelPicker should be visible.
    await expect(page.getByTestId('media-studio-model-picker-video')).toBeVisible();

    // Generate the visual. En kind=video le bouton dit « Générer une vidéo IA »
    // (MediaStudio.tsx:240) — pas « un visuel IA » (qui est le libellé image).
    await page.getByRole('button', { name: /Générer une vidéo IA/i }).click();
    await expect(page.locator('video').first()).toBeVisible({ timeout: 15_000 });

    // The payload sent to the API should contain kind=video.
    expect(state.lastVisualBody?.kind).toBe('video');

    // The static MP4 asset should be reachable.
    const src = await page.locator('video').first().getAttribute('src');
    expect(src).toContain('/_media/content-studio/mock/');
  });

  test('switching to image kind sends kind=image', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Reel à tester en mode image cette fois.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    // Switch to Image kind
    await page.locator('button[role="radio"][data-cs-kind="image"]').click();
    await page.getByRole('button', { name: /Générer (un visuel|une vidéo) IA/i }).click();
    await expect(page.locator('img').first()).toBeVisible({ timeout: 15_000 });
    expect(state.lastVisualBody?.kind).toBe('image');
  });
});
