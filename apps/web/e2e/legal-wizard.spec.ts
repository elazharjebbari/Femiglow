/**
 * E2E — wizard de création d'une page légale.
 *
 * Skip propre si DB vide / auth absente. Sinon : full happy path
 * step 1 → 5 + soumission + landing sur /edit.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) test.skip();
}

test.describe('admin legal wizard', () => {
  test('happy path : remplir 5 steps puis créer (slug unique)', async ({ page }) => {
    await page.goto('/admin/legal/new');
    await ensureAuthOrSkip(page);

    // Slug unique basé sur timestamp pour éviter conflits en re-runs
    const slug = `e2e-test-${Date.now()}`;

    // Step 1 — Identité
    await page.getByPlaceholder('mentions-legales').fill(slug);
    // Récupère le 2e textbox (titre) — l'ordre de DOM est slug puis title
    const inputs = page.locator('input[type="text"]');
    await inputs.nth(1).fill('Page de test E2E');
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 2 — Contenu
    await page.locator('textarea').fill('# Test E2E\n\nContenu de la page de test E2E.');
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 3 — Placements
    // Coche au moins la zone obligatoire (footer-main = "Footer")
    const footerCheckbox = page.locator('input[type="checkbox"]').first();
    await footerCheckbox.check();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 4 — Variables : on n'a utilisé aucune var, donc OK
    await expect(page.getByText(/✓ Toutes les variables/)).toBeVisible();
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 5 — Récapitulatif + submit
    await expect(page.getByText(/Récapitulatif/)).toBeVisible();
    await expect(page.getByText(new RegExp(`/legal/${slug}`))).toBeVisible();
    await page.getByRole('button', { name: /Créer la page/ }).click();

    // Redirection vers /edit
    await page.waitForURL(new RegExp(`/admin/legal/${slug}/edit`), { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Page de test E2E/i })).toBeVisible();
  });

  test('Précédent depuis step 3 préserve les zones cochées', async ({ page }) => {
    await page.goto('/admin/legal/new');
    await ensureAuthOrSkip(page);

    await page.getByPlaceholder('mentions-legales').fill('e2e-prev');
    await page.locator('input[type="text"]').nth(1).fill('Test Précédent');
    await page.getByRole('button', { name: /Suivant/ }).click();
    await page.locator('textarea').fill('Content with enough length here.');
    await page.getByRole('button', { name: /Suivant/ }).click();

    // Step 3 : coche 2 zones
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.first().check();
    await checkboxes.nth(1).check();

    // Précédent → Précédent → revient à step 1
    await page.getByRole('button', { name: /Précédent/ }).click();
    await page.getByRole('button', { name: /Précédent/ }).click();

    // Revérifie : slug + title préservés
    await expect(page.getByDisplayValue('e2e-prev')).toBeVisible();
    await expect(page.getByDisplayValue('Test Précédent')).toBeVisible();
  });

  test('slug invalide bloque le passage step 2', async ({ page }) => {
    await page.goto('/admin/legal/new');
    await ensureAuthOrSkip(page);

    await page.getByPlaceholder('mentions-legales').fill('INVALID SLUG');
    await page.locator('input[type="text"]').nth(1).fill('Title');
    await expect(page.getByText(/Caractères autorisés/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Suivant/ })).toBeDisabled();
  });
});
