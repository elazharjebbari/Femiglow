import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // /admin/content-studio redirige vers la v2 (CONTENT_STUDIO_V2_DEFAULT) ;
    // le module v1 vit sur l'URL legacy stable.
    await page.goto('/admin/content-studio-legacy');
    await page.waitForURL('/admin/content-studio-legacy');
  });

  // --- Layout & navigation ---

  test('affiche le titre et le guide', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Studio contenu' })).toBeVisible();
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
    // Base sans brouillon → état vide « Générez une idée pour ouvrir l'éditeur » ;
    // avec des brouillons → panneau « Brouillons ». Les deux états sont valides.
    await expect(
      page
        .getByRole('heading', { name: 'Brouillons' })
        .or(page.getByText(/Générez une idée pour ouvrir l/i)),
    ).toBeVisible();
  });

  test('les champs du formulaire idée sont interactifs', async ({ page }) => {
    const promptInput = page.getByPlaceholder(/décrivez/i);
    if (await promptInput.isVisible()) {
      await promptInput.fill('Test prompt de contenu FemiGlow');
      await expect(promptInput).toHaveValue('Test prompt de contenu FemiGlow');
    }
  });

  test('crée une idée depuis l’UI et la conserve après rechargement', async ({ page }) => {
    const prompt = `codex-staging-${Date.now()} idée persistée depuis Playwright`;

    await page.getByLabel('Intention').fill(prompt);
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    await expect(page.locator('li').filter({ hasText: prompt })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await page.waitForURL('/admin/content-studio-legacy');
    await expect(page.locator('li').filter({ hasText: prompt })).toBeVisible();
  });

  test('génère des brouillons et un visuel IA mock depuis l’UI', async ({ page }) => {
    const prompt = `codex-ai-generation-${Date.now()} pipeline UI complet`;

    await page.getByLabel('Intention').fill(prompt);
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    const ideaItem = page.locator('li').filter({ hasText: prompt }).first();
    await expect(ideaItem).toBeVisible({ timeout: 10_000 });

    const generationResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/content-studio/ideas/') &&
      response.url().endsWith('/generate') &&
      response.request().method() === 'POST',
    );
    await ideaItem.getByRole('button', { name: /Générer 3 propositions/i }).click();
    const generationResponse = await generationResponsePromise;
    expect(generationResponse.status()).toBe(200);
    const generationBody = (await generationResponse.json()) as {
      drafts?: Array<{ id: string; variantLabel: string }>;
    };
    expect(generationBody.drafts).toHaveLength(3);
    await expect(page.getByText('Brouillons générés et scorés.')).toBeVisible({ timeout: 10_000 });

    const firstDraft = generationBody.drafts?.[0];
    expect(firstDraft?.id).toBeTruthy();
    await expect(
      page.getByRole('button', { name: new RegExp(firstDraft!.variantLabel, 'i') }).first(),
    ).toBeVisible();

    const visualResponsePromise = page.waitForResponse((response) =>
      response
        .url()
        .includes(`/api/admin/content-studio/drafts/${firstDraft!.id}/generate-visual`) &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Générer le visuel/i }).click();
    const visualResponse = await visualResponsePromise;
    expect(visualResponse.status()).toBe(200);
    const visualBody = (await visualResponse.json()) as {
      media?: { id?: string; compartment?: string; previewUrl?: string | null };
    };
    expect(visualBody.media?.id).toBeTruthy();
    expect(visualBody.media?.compartment).toBe('ai_generated');
    expect(visualBody.media?.previewUrl).toBeTruthy();
    await expect(page.getByText('Visuel IA généré, optimisé et sélectionné.')).toBeVisible({
      timeout: 20_000,
    });
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
    await page.waitForURL('/admin/content-studio-legacy');
    await expect(page.getByRole('heading', { name: 'Studio contenu' })).toBeVisible();
  });

  test('la page reste fonctionnelle si l\'API retourne 401', async ({ page }) => {
    await page.route('**/api/admin/content-studio/ideas**', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ error: { code: 'unauthorized', message: 'Non autorisé' } }) }),
    );
    await page.reload();
    await page.waitForURL('/admin/content-studio-legacy');
    await expect(page.getByRole('heading', { name: 'Studio contenu' })).toBeVisible();
  });
});
