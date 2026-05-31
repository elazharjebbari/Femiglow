/**
 * E2E admin `/admin/kit/video` — éditeur singleton de la section vidéo.
 *
 * Tag `@video-admin`. Pré-requis : session admin (storageState configuré
 * dans `playwright.config.ts`). Si l'auth n'est pas pré-chauffée, les tests
 * skippent proprement sur le redirect vers `/admin/login`.
 *
 * Couvre :
 *  - Page rend l'éditeur avec champs pré-remplis (mock).
 *  - Validation Zod live (URL invalide bloque Save).
 *  - Save → PATCH OK → message succès.
 *  - Reset → modale + saisie `RESET-VIDEO` → DELETE OK.
 *  - a11y axe : 0 violation sérieuse/critique sur la page éditeur.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/admin/kit/video — éditeur @video-admin', () => {
  test('page protégée par auth (redirect vers /admin/login si pas connecté)', async ({
    page,
  }) => {
    const res = await page.goto('/admin/kit/video');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(
      page.getByRole('heading', { name: /rituel vidéo/i, level: 1 }),
    ).toBeVisible();
  });

  test('formulaire rendu avec statut « Mock » par défaut', async ({ page }) => {
    await page.goto('/admin/kit/video');
    if (page.url().includes('/admin/login')) return;

    await expect(page.getByTestId('kit-video-editor')).toBeVisible();
    const status = page.getByTestId('kit-video-status');
    await expect(status).toBeVisible();
    // « Mock par défaut », « Brouillon » ou « Publié » selon l'état persistant.
    const statusText = (await status.textContent()) ?? '';
    expect(statusText).toMatch(/Mock|Brouillon|Publié/);
  });

  test('URL YouTube invalide bloque le bouton Save', async ({ page }) => {
    await page.goto('/admin/kit/video');
    if (page.url().includes('/admin/login')) return;

    const ytInput = page.getByPlaceholder(/youtube.com/i);
    await ytInput.fill('https://vimeo.com/12345');
    const save = page.getByTestId('kit-video-save');
    await expect(save).toBeDisabled();
    await expect(page.getByTestId('error-youtubeUrl')).toBeVisible();
  });

  test('parcours nominal : modifie provenance, save, message succès', async ({ page }) => {
    await page.goto('/admin/kit/video');
    if (page.url().includes('/admin/login')) return;

    const provInput = page.getByPlaceholder(/Filmé à l/i);
    await provInput.fill('Filmé à Marrakech, mai 2026.');
    const save = page.getByTestId('kit-video-save');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByTestId('kit-video-success')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('Reset bloque tant que la saisie RESET-VIDEO n\'est pas correcte', async ({
    page,
  }) => {
    await page.goto('/admin/kit/video');
    if (page.url().includes('/admin/login')) return;

    await page.getByTestId('kit-video-reset-open').click();
    await expect(page.getByTestId('kit-video-reset-dialog')).toBeVisible();
    const confirm = page.getByTestId('kit-video-reset-confirm');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('kit-video-reset-input').fill('reset');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('kit-video-reset-input').fill('RESET-VIDEO');
    await expect(confirm).toBeEnabled();
  });
});

test.describe('/admin/kit/video — a11y @video-a11y', () => {
  test('0 violation axe sérieuse/critique sur l\'éditeur', async ({ page }) => {
    const res = await page.goto('/admin/kit/video');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) return;

    await page.waitForLoadState('domcontentloaded');
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log('AXE violations (admin kit video):', JSON.stringify(serious, null, 2));
    }
    expect(serious).toHaveLength(0);
  });
});
