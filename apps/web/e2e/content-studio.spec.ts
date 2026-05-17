import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/content-studio');
    await page.waitForURL('/admin/content-studio');
  });

  // --- Layout & navigation ---

  test('affiche le titre et le guide', async ({ page }) => {
    await expect(page.getByText('Studio contenu')).toBeVisible();
    await expect(page.getByText('AI Content Studio')).toBeVisible();
  });

  test('affiche les 4 onglets par défaut', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Calendrier' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Budget' })).toBeVisible();
  });

  test('Pipeline est actif par défaut', async ({ page }) => {
    const pipelineTab = page.getByRole('button', { name: 'Pipeline' });
    await expect(pipelineTab).toHaveClass(/bg-stone-900/);
  });

  // --- Tab navigation ---

  test('change vers l\'onglet Calendrier', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByText('Pipeline éditorial')).toBeVisible();
  });

  test('change vers l\'onglet Analytics', async ({ page }) => {
    await page.getByRole('button', { name: 'Analytics' }).click();
    await expect(page.getByText('Tableau de bord')).toBeVisible();
  });

  test('change vers l\'onglet Budget', async ({ page }) => {
    await page.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByText('Coûts de génération')).toBeVisible();
  });

  test('revient sur Pipeline depuis un autre onglet', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByText('Pipeline éditorial')).toBeVisible();
    await page.getByRole('button', { name: 'Pipeline' }).click();
    await expect(page.getByText('Créer une idée')).toBeVisible();
  });

  // --- Pipeline tab ---

  test('affiche le formulaire de création d\'idée', async ({ page }) => {
    await expect(page.getByText('Créer une idée')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enregistrer l'idée/i })).toBeVisible();
  });

  test('affiche l\'éditeur de brouillon', async ({ page }) => {
    await expect(page.getByText('Brouillons')).toBeVisible();
  });

  test('les champs du formulaire idée sont interactifs', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/décrivez/i);
    if (await promptInput.isVisible()) {
      await promptInput.fill('Test prompt de contenu FemiGlow');
      await expect(promptInput).toHaveValue('Test prompt de contenu FemiGlow');
    }
  });

  // --- Calendar tab ---

  test('les filtres du calendrier sont visibles après changement d\'onglet', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByText('Semaine')).toBeVisible();
    await expect(page.getByText('Mois')).toBeVisible();
  });

  test('le bouton Auj. est présent dans le calendrier', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    await expect(page.getByRole('button', { name: 'Auj.' })).toBeVisible();
  });

  test('navigation entre semaines dans le calendrier', async ({ page }) => {
    await page.getByRole('button', { name: 'Calendrier' }).click();
    const prevBtn = page.getByRole('button', { name: /précédent|←|‹/i });
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
    }
  });

  // --- Budget tab ---

  test('le bouton Charger les données est visible dans Budget', async ({ page }) => {
    await page.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByText('Coûts de génération')).toBeVisible();
    const loadBtn = page.getByRole('button', { name: /Charger|Rafraîchir/i });
    await expect(loadBtn).toBeVisible();
  });

  test('charge les données budget après clic', async ({ page }) => {
    await page.getByRole('button', { name: 'Budget' }).click();
    const loadBtn = page.getByRole('button', { name: /Charger/i });
    await loadBtn.click();
    // Wait for data to load (may show 0 € or actual costs)
    await page.waitForTimeout(2000);
  });

  // --- Analytics tab ---

  test('affiche le tableau de bord Analytics', async ({ page }) => {
    await page.getByRole('button', { name: 'Analytics' }).click();
    await expect(page.getByText('Tableau de bord')).toBeVisible();
  });

  // --- API error resilience ---

  test('la page reste fonctionnelle si l\'API retourne une erreur', async ({ page }) => {
    await page.route('**/api/admin/content-studio/ideas**', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: { code: 'internal', message: 'Server error' } }) }),
    );
    await page.reload();
    await page.waitForURL('/admin/content-studio');
    await expect(page.getByText('Studio contenu')).toBeVisible();
  });

  test('la page reste fonctionnelle si l\'API retourne 401', async ({ page }) => {
    await page.route('**/api/admin/content-studio/ideas**', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: { code: 'unauthorized', message: 'Non autorisé' } }) }),
    );
    await page.reload();
    await page.waitForURL('/admin/content-studio');
    await expect(page.getByText('Studio contenu')).toBeVisible();
  });
});