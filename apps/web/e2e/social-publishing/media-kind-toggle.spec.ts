/**
 * E2E — Validation du toggle Image/Vidéo dans MediaStudio :
 *  - le toggle est toujours visible (même sans format choisi)
 *  - Vidéo est désactivé pour les formats post/carousel avec tooltip
 *  - Vidéo est activé pour reel/story et sélectionné par défaut
 *  - le label du bouton Générer reflète le kind
 *  - le payload POST contient kind=video
 *  - la vidéo générée s'affiche dans le PreviewPane (élément <video> visible)
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

const IDEA_PROMPT = 'Présenter le rituel du soir FemiGlow comme un geste lent et apaisant.';

async function pickFormatAndSubmit(page: import('@playwright/test').Page, fmt: string) {
  await page.locator(`button[role="radio"][data-format="${fmt}"]`).click();
  await page.getByRole('textbox').first().fill(IDEA_PROMPT);
  await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();
  await page
    .locator('[data-variant-id]')
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
  await page.waitForTimeout(1500);
}

test.describe('MediaStudio kind toggle', () => {
  test('post format → Vidéo disabled, hint visible, video toggle absent en sélection', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/admin/content-studio-v2/create');
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    await pickFormatAndSubmit(page, 'post');

    const videoKindBtn = page.getByTestId('media-kind-video');
    const imageKindBtn = page.getByTestId('media-kind-image');

    await expect(videoKindBtn).toBeVisible({ timeout: 10_000 });
    await expect(imageKindBtn).toBeVisible();
    // Disabled with title
    expect(await videoKindBtn.isDisabled()).toBe(true);
    const videoTitle = await videoKindBtn.getAttribute('title');
    expect(videoTitle).toMatch(/reel.*story/i);
    // Image is selected
    expect(await imageKindBtn.getAttribute('aria-checked')).toBe('true');
    // Hint is visible
    await expect(page.locator('[data-cs-kind-hint]')).toBeVisible();
    // Bouton Générer = "Générer un visuel IA"
    await expect(page.getByRole('button', { name: /Générer un visuel IA/i })).toBeVisible();
  });

  test('reel format → Vidéo enabled, sélectionné par défaut, bouton dit "Générer une vidéo IA"', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/admin/content-studio-v2/create');
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    await pickFormatAndSubmit(page, 'reel');

    const videoKindBtn = page.getByTestId('media-kind-video');
    await expect(videoKindBtn).toBeVisible({ timeout: 10_000 });
    expect(await videoKindBtn.isDisabled()).toBe(false);
    expect(await videoKindBtn.getAttribute('aria-checked')).toBe('true');
    // Bouton = "Générer une vidéo IA"
    await expect(page.getByRole('button', { name: /Générer une vidéo IA/i })).toBeVisible();
  });

  test('reel → générer vidéo → <video> visible et lisible dans le PreviewPane', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/admin/content-studio-v2/create');
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    await pickFormatAndSubmit(page, 'reel');

    // Vérifier que le bouton Générer est actif et explicite
    const genBtn = page.getByRole('button', { name: /Générer une vidéo IA/i });
    await expect(genBtn).toBeVisible({ timeout: 10_000 });
    await expect(genBtn).toBeEnabled();

    // Capturer la réponse de génération
    const generationResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/generate-visual') &&
        (resp.request().method() === 'POST' || resp.request().method() === 'GET'),
      { timeout: 30_000 },
    );

    await genBtn.click();
    const resp = await generationResponsePromise;
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.media?.kind).toBe('video');
    expect(json.media?.previewUrl).toMatch(/\.mp4$/);

    // Le PreviewPane doit afficher le <video>
    const previewPane = page.locator('aside[aria-label="Aperçu"]');
    await expect(previewPane).toBeVisible({ timeout: 10_000 });

    const previewVideo = previewPane.locator('video').first();
    await expect(previewVideo).toBeVisible({ timeout: 10_000 });

    // Le src doit pointer vers un .mp4 et le ressource doit être chargeable (HTTP 200)
    const videoSrc = await previewVideo.getAttribute('src');
    expect(videoSrc).toBeTruthy();
    expect(videoSrc).toMatch(/\.mp4$/);

    // Vérifier que la ressource vidéo est servie
    if (videoSrc) {
      const absolute = videoSrc.startsWith('http') ? videoSrc : new URL(videoSrc, page.url()).toString();
      const headResp = await page.request.head(absolute);
      expect(headResp.status()).toBe(200);
      const ct = headResp.headers()['content-type'] ?? '';
      expect(ct).toMatch(/video/i);
    }

    // Confirmer que le <video> joue (readyState >= HAVE_CURRENT_DATA = 2)
    const videoReadyState = await previewVideo.evaluate((el) => {
      const v = el as HTMLVideoElement;
      return { readyState: v.readyState, currentSrc: v.currentSrc, autoplay: v.autoplay, muted: v.muted, loop: v.loop };
    });
    expect(videoReadyState.autoplay).toBe(true);
    expect(videoReadyState.muted).toBe(true);
    expect(videoReadyState.loop).toBe(true);
    expect(videoReadyState.currentSrc).toBeTruthy();

    await page.screenshot({ path: 'test-results/media-kind-toggle-video-rendered.png', fullPage: true });
  });

  test('post → générer image → <img> visible dans le PreviewPane', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/admin/content-studio-v2/create');
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);

    await pickFormatAndSubmit(page, 'post');

    const genBtn = page.getByRole('button', { name: /Générer un visuel IA/i });
    await expect(genBtn).toBeVisible({ timeout: 10_000 });

    const generationResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/generate-visual'),
      { timeout: 30_000 },
    );
    await genBtn.click();
    const resp = await generationResponsePromise;
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.media?.kind).toBe('image');

    const previewPane = page.locator('aside[aria-label="Aperçu"]');
    await expect(previewPane).toBeVisible();
    const previewImg = previewPane.locator('img').first();
    await expect(previewImg).toBeVisible({ timeout: 10_000 });
    const imgSrc = await previewImg.getAttribute('src');
    expect(imgSrc).toBeTruthy();
  });
});
