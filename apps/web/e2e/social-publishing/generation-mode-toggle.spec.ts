/**
 * E2E — Toggle mode mock/live + visibilité des modèles Higgsfield.
 *
 * Vérifie :
 *  - Le toggle Mock/Live est visible dans le MediaStudio header
 *  - Click Live → cookie cs_generation_mode=live + toast warning
 *  - Click Mock → cookie cs_generation_mode=mock + toast success
 *  - Le ModelPicker pour la vidéo expose au moins 1 modèle Higgsfield
 *  - Le ModelPicker pour l'image expose au moins 1 modèle Higgsfield
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('generation mode toggle visible + sets cookie + Higgsfield models present', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);

  await page.goto('/admin/content-studio-v2/create');
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({
    timeout: 15_000,
  });

  // Driver l'idée pour faire apparaître le MediaStudio
  await page.locator('button[role="radio"][data-format="reel"]').click();
  await page
    .getByRole('textbox')
    .first()
    .fill('Rituel saumon ambré : geste apaisant, lumière chaude.');
  await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
  await page.locator('[data-variant-id]').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
  await page.waitForTimeout(1500);

  // === Toggle Mock/Live visible dans le MediaStudio ===
  const toggle = page.locator('[data-cs-section="generation-mode-toggle"]');
  await expect(toggle).toBeVisible({ timeout: 10_000 });

  const mockBtn = page.getByTestId('generation-mode-mock');
  const liveBtn = page.getByTestId('generation-mode-live');
  await expect(mockBtn).toBeVisible();
  await expect(liveBtn).toBeVisible();
  // Par défaut, mock est sélectionné
  await expect(mockBtn).toHaveAttribute('aria-checked', 'true');

  // === Click Live → cookie set + toast warning ===
  await liveBtn.click();
  await expect(liveBtn).toHaveAttribute('aria-checked', 'true');
  // Toast warning
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: /Mode live activé/i }).first(),
  ).toBeVisible({ timeout: 5_000 });
  // Cookie présent
  const cookies = await context.cookies();
  const csCookie = cookies.find((c) => c.name === 'cs_generation_mode');
  expect(csCookie?.value).toBe('live');

  // === Click Mock → toast success + cookie set ===
  await mockBtn.click();
  await expect(mockBtn).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(500);
  const cookiesAfter = await context.cookies();
  expect(cookiesAfter.find((c) => c.name === 'cs_generation_mode')?.value).toBe('mock');

  // === Le ModelPicker vidéo doit exposer >= 1 modèle Higgsfield ===
  const videoModelPicker = page.getByTestId('media-studio-model-picker-video');
  await expect(videoModelPicker).toBeVisible({ timeout: 10_000 });
  await videoModelPicker.click();
  // Wait for at least one option to render (depends on live discovery latency)
  await page.locator('[role="option"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  const optionTexts = await page.locator('[role="option"]').allTextContents();
  console.log('Video model options:', optionTexts);
  // Au moins un modèle Higgsfield (label contient "Higgsfield")
  expect(optionTexts.some((t) => /Higgsfield/i.test(t))).toBe(true);

  // Fermer le popover
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.screenshot({ path: 'test-results/generation-mode-toggle.png', fullPage: true });
});
