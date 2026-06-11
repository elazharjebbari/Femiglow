/**
 * CS v2 create-audit Phase 7 — broader ModelPicker UX coverage.
 *
 * The golden-path spec already verifies one text-model switch. This spec
 * focuses on:
 *   - default vs suggested behaviour
 *   - separate image vs video pickers in MediaStudio
 *   - sending the picked image/video model to /drafts/:id/generate-visual
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — model switching', () => {
  test('no explicit model → request carries the suggested model (auto-select)', async ({
    page,
  }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Intention E2E default model.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });

    // Le ModelPicker auto-sélectionne désormais la suggestion (fetch eager) :
    // le client envoie body.model = suggested.id au lieu de l'omettre.
    expect(state.lastIdeasBody?.model).toBe('gpt-4o-mini');
    expect(state.lastGenerateBody?.model).toBe('gpt-4o-mini');
  });

  test('reel format exposes the role=video ModelPicker by default', async ({ page }) => {
    await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByRole('textbox').first().fill('Reel à tester.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    // Video picker is active for reel.
    const videoPicker = page.getByTestId('media-studio-model-picker-video');
    await expect(videoPicker).toBeVisible();
    // Switching to Image swaps the picker.
    await page.locator('button[role="radio"][data-cs-kind="image"]').click();
    await expect(page.getByTestId('media-studio-model-picker-image')).toBeVisible();
  });

  test('chosen image model is forwarded to POST /generate-visual', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Use the explicit data-format selector to avoid accidental name regex
    // matches in the radio group.
    await page.locator('[data-format="post"]').click();
    await page.getByRole('textbox').first().fill('Post à générer en image.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    // Sanity: format should have round-tripped as 'post'.
    expect((state.lastIdeasBody as { format?: string } | undefined)?.format).toBe('post');

    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    // For post format, no kind toggle is shown; the picker is the image one.
    const picker = page.getByTestId('media-studio-model-picker-image');
    await expect(picker).toBeVisible({ timeout: 5_000 });
    await picker.click();
    await page.getByTestId('model-picker-item-dall-e-3').click();
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('img').first()).toBeVisible({ timeout: 15_000 });

    expect(state.lastVisualBody?.kind).toBe('image');
    expect(state.lastVisualBody?.model).toBe('dall-e-3');
  });
});
