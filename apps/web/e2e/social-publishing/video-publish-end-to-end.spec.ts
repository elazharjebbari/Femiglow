/**
 * E2E — Publication vidéo bout-en-bout (mode mock).
 *
 * Drive le flow complet :
 *  1. Format reel → idée → variantes → variante sélectionnée
 *  2. Génération vidéo (kind=video par défaut sur reel)
 *  3. Vérifier que le PreviewPane affiche le VideoPlayer avec badge VIDÉO + durée
 *  4. Vérifier la ligne metadata dans MediaStudio
 *  5. Approuver (CTA "Valider et préparer la publication")
 *  6. Ouvrir dropdown Publier → choisir "Publier maintenant"
 *  7. Vérifier le mini-player vidéo + ligne metadata dans la confirm dialog
 *  8. Confirmer → POST /publish-now → status 200
 *  9. Toast succès visible
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('video publish end-to-end: idea (reel) → video gen → approve → publish-now', async ({
  page,
}) => {
  test.setTimeout(240_000);

  await page.goto('/admin/content-studio-v2/create');
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(1500);

  // 1. Format reel + idée
  await page.locator('button[role="radio"][data-format="reel"]').click();
  await page
    .getByRole('textbox')
    .first()
    .fill('Rituel du soir : un geste lent qui apaise et prépare la peau.');
  await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

  // 2. Variantes → sélection
  await page.locator('[data-variant-id]').first().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
  await page.waitForTimeout(2000);

  // 3. Générer la vidéo
  const genBtn = page.getByRole('button', { name: /Générer une vidéo IA/i });
  await expect(genBtn).toBeVisible({ timeout: 10_000 });
  await expect(genBtn).toBeEnabled();
  const genRespPromise = page.waitForResponse(
    (resp) => resp.url().includes('/generate-visual') && resp.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await genBtn.click();
  const genResp = await genRespPromise;
  expect(genResp.status()).toBe(200);
  const genJson = await genResp.json();
  expect(genJson.media?.kind).toBe('video');

  // 4. Le PreviewPane doit afficher le VideoPlayer enrichi
  const previewPane = page.locator('aside[aria-label="Aperçu"]');
  const previewPlayer = previewPane.locator('[data-cs-video-player]').first();
  await expect(previewPlayer).toBeVisible({ timeout: 10_000 });
  const previewBadge = previewPlayer.locator('[data-cs-video-badge]');
  await expect(previewBadge).toContainText(/VIDÉO/);

  // 5. Le MediaStudio doit afficher la ligne metadata (durée + dimensions)
  const mediaStudio = page.locator('section[aria-label="Studio média"]');
  const metaLine = mediaStudio.locator('[data-cs-section="media-metadata"]');
  await expect(metaLine).toBeVisible({ timeout: 5_000 });
  await expect(metaLine).toContainText(/Vidéo/);

  // 6. Approuver le draft
  const approveBtn = page.getByTestId('approve-draft-button');
  await expect(approveBtn).toBeVisible({ timeout: 10_000 });
  await expect(approveBtn).toBeEnabled();
  const approveResp = page.waitForResponse(
    (resp) =>
      resp.url().includes('/drafts/') &&
      resp.url().endsWith('/approve') &&
      resp.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await approveBtn.click();
  const approveOk = await approveResp;
  expect(approveOk.status()).toBe(200);
  await page.waitForTimeout(1500);

  // 7. Ouvrir dropdown Publier (aria-label="Options de publication")
  const publishTrigger = page.getByRole('button', { name: /Options de publication/i });
  await expect(publishTrigger).toBeVisible({ timeout: 10_000 });
  await expect(publishTrigger).toBeEnabled({ timeout: 10_000 });
  await publishTrigger.click();

  // Cliquer "Publier maintenant" dans le dropdown
  const publishNowItem = page.getByRole('menuitem', { name: /Publier maintenant/i });
  await expect(publishNowItem).toBeVisible({ timeout: 5_000 });
  await publishNowItem.click();

  // 8. Vérifier le contenu de la dialog : mini VideoPlayer + ligne metadata
  const confirmPreview = page.getByTestId('publish-confirm-preview');
  await expect(confirmPreview).toBeVisible({ timeout: 10_000 });
  await expect(confirmPreview.locator('[data-cs-video-player]')).toBeVisible();
  await expect(confirmPreview.locator('video')).toHaveCount(1);
  const confirmMeta = page.getByTestId('publish-confirm-media-meta');
  await expect(confirmMeta).toBeVisible();
  await expect(confirmMeta).toContainText(/Vidéo/);

  // 9. Confirmer la publication (le bouton du Dialog s'appelle juste "Confirmer")
  const confirmBtn = page.getByRole('button', { name: /^Confirmer$/i });
  await expect(confirmBtn).toBeVisible();
  const publishResp = page.waitForResponse(
    (resp) =>
      resp.url().includes('/posts/') &&
      resp.url().includes('/publish-now') &&
      resp.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await confirmBtn.click();
  const publishOk = await publishResp;
  // publish-now success returns 201 (created); accept any 2xx
  const status = publishOk.status();
  if (status >= 400) {
    const body = await publishOk.text().catch(() => '<unreadable>');
    console.log(`publish-now failed status=${status} body=${body.slice(0, 300)}`);
  }
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);

  // 10. Toast succès
  await page.waitForTimeout(1500);
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: /Publi|succès|publiée?/i });
  await expect(toast.first()).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: 'test-results/video-publish-end-to-end.png', fullPage: true });
});
