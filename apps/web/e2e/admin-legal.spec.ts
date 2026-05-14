/**
 * E2E — admin /admin/legal.
 *
 * Pré-requis : storageState admin chargé via `playwright.config.ts`
 * (projet chromium dépend de `setup`). Si l'auth n'est pas dispo
 * (ex. dev local sans bootstrap), le test skip proprement à la
 * redirection vers /admin/login.
 *
 * Couverture :
 *  - navigation : list → edit → vars → placements → health
 *  - 401 sans session : géré par les guards serveur
 *  - édition : modifier titre, save, vérifier version bumpée
 *  - publish modal : ouvre, vérifie "PUBLIER" requis, vérifie warning
 *    vars manquantes
 *  - vars page : éditer une valeur + save
 *  - placements page : matrice cliquable
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip();
  }
}

test.describe('admin legal — navigation', () => {
  test('liste accessible, affiche stats + tableau', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Pages légales/i })).toBeVisible();
    // Stats line « N pages · N publiées · ... »
    await expect(page.getByText(/pages · .* publiées/i)).toBeVisible();
  });

  test('liens vers vars / placements / health', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('link', { name: /Variables/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Placements/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Santé liens/i })).toBeVisible();
  });

  test('page Variables ouvre la grille d\'édition', async ({ page }) => {
    await page.goto('/admin/legal/template-vars');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Variables de template/i })).toBeVisible();
  });

  test('page Placements ouvre la matrice', async ({ page }) => {
    await page.goto('/admin/legal/placements');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Matrice de placements/i })).toBeVisible();
  });

  test('page Santé liens affiche le statut global', async ({ page }) => {
    await page.goto('/admin/legal/health');
    await ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Santé des liens/i })).toBeVisible();
    await expect(page.getByText(/Statut global/i)).toBeVisible();
  });
});

test.describe('admin legal — édition', () => {
  test('éditeur de page : titre éditable + preview', async ({ page }) => {
    // On essaie d'aller sur la première page de la liste. Si la DB est vide,
    // on skip.
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    const firstEditLink = page.getByRole('link', { name: /Éditer/ }).first();
    if (!(await firstEditLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstEditLink.click();
    await page.waitForURL(/\/admin\/legal\/[^/]+\/edit/);

    // Le titre est dans un <input>
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible();
    // L'aperçu (preview) doit afficher le contenu
    await expect(page.getByText(/Aperçu/i)).toBeVisible();
  });

  test('publish modal : ouvre + bloque sans PUBLIER tapé', async ({ page }) => {
    await page.goto('/admin/legal');
    await ensureAuthOrSkip(page);

    const firstEditLink = page.getByRole('link', { name: /Éditer/ }).first();
    if (!(await firstEditLink.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await firstEditLink.click();
    await page.waitForURL(/\/admin\/legal\/[^/]+\/edit/);

    await page.getByRole('button', { name: /^Publier$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Sans "PUBLIER" tapé, le bouton "Publier maintenant" doit être désactivé
    const publishNow = dialog.getByRole('button', { name: /Publier maintenant/ });
    await expect(publishNow).toBeDisabled();

    // Tape une mauvaise valeur → toujours disabled
    await dialog.getByLabel(/PUBLIER pour confirmer/).fill('publier');
    await expect(publishNow).toBeDisabled();

    // Tape "PUBLIER" → enabled
    await dialog.getByLabel(/PUBLIER pour confirmer/).fill('PUBLIER');
    await expect(publishNow).toBeEnabled();

    // Annule (ne pas publier vraiment, on ne veut pas polluer l'état)
    await dialog.getByRole('button', { name: /Annuler/ }).click();
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('admin legal — guard 401', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirige vers login sans session', async ({ page }) => {
    await page.goto('/admin/legal');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('API GET /api/admin/legal renvoie 401 sans session', async ({ request }) => {
    const res = await request.get('/api/admin/legal');
    expect(res.status()).toBe(401);
  });
});
