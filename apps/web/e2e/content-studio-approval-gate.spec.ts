import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio — auto-bind & approval gate (S1.1)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/content-studio');
    await page.waitForURL('/admin/content-studio');
  });

  test('cas 1 — auto-bind : générer visuel puis approuver sans cliquer Sauvegarder', async ({ page }) => {
    const prompt = `s1.1-autobind-${Date.now()} valider approbation directe après génération`;

    await page.getByLabel('Intention').fill(prompt);
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    const ideaItem = page.locator('li').filter({ hasText: prompt }).first();
    await expect(ideaItem).toBeVisible({ timeout: 10_000 });

    // 1. Générer brouillons (drafts → status needs_review après review automatique)
    const generationResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/content-studio/ideas/') &&
      response.url().endsWith('/generate') &&
      response.request().method() === 'POST',
    );
    await ideaItem.getByRole('button', { name: /Générer 3 propositions/i }).click();
    const generationResponse = await generationResponsePromise;
    expect(generationResponse.status()).toBe(200);
    await expect(page.getByText('Brouillons générés et scorés.')).toBeVisible({ timeout: 10_000 });

    // 2. Générer le visuel — doit auto-bind le primary_asset (fix cfc53f0)
    const visualResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/generate-visual') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Générer le visuel/i }).click();
    const visualResponse = await visualResponsePromise;
    expect(visualResponse.status()).toBe(200);
    await expect(page.getByText('Visuel IA généré, optimisé et sélectionné.')).toBeVisible({
      timeout: 20_000,
    });

    // 3. CRITIQUE : cliquer Approuver SANS passer par « Sauvegarder + relire »
    //    Cette étape échouait avant cfc53f0 car le primary_asset n'était pas persisté.
    const approveResponsePromise = page.waitForResponse((response) =>
      response.url().match(/\/api\/admin\/content-studio\/drafts\/[^/]+\/approve$/) &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Approuver$/ }).click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status()).toBe(200);

    // 4. Vérifier message de succès + aucune alerte d'erreur visible
    //    NB : role="alert" matche aussi __next-route-announcer__, on filtre
    //    sur la classe spécifique de l'alerte d'erreur de ContentStudioClient.
    await expect(page.getByText('Brouillon approuvé.')).toBeVisible({ timeout: 10_000 });
    const errorAlert = page.locator('p[role="alert"].bg-red-50');
    if (await errorAlert.count() > 0) {
      const alertText = await errorAlert.first().textContent();
      expect(alertText ?? '').not.toMatch(/visuel doit être associé/i);
    }
  });

  test('cas 2 — gate refuse : approuver sans visuel produit un message clair', async ({ page }) => {
    const prompt = `s1.1-gate-${Date.now()} valider refus approbation sans visuel`;

    await page.getByLabel('Intention').fill(prompt);
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    const ideaItem = page.locator('li').filter({ hasText: prompt }).first();
    await expect(ideaItem).toBeVisible({ timeout: 10_000 });

    // 1. Générer brouillons (mais PAS de visuel)
    const generationResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/admin/content-studio/ideas/') &&
      response.url().endsWith('/generate') &&
      response.request().method() === 'POST',
    );
    await ideaItem.getByRole('button', { name: /Générer 3 propositions/i }).click();
    const generationResponse = await generationResponsePromise;
    expect(generationResponse.status()).toBe(200);
    await expect(page.getByText('Brouillons générés et scorés.')).toBeVisible({ timeout: 10_000 });

    // 2. Tenter d'approuver directement — doit échouer avec invalid_state
    const approveResponsePromise = page.waitForResponse((response) =>
      response.url().match(/\/api\/admin\/content-studio\/drafts\/[^/]+\/approve$/) &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^Approuver$/ }).click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status()).toBe(409); // invalid_state

    const body = (await approveResponse.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe('invalid_state');
    expect(body.error?.message).toMatch(/visuel doit être associé/i);
    expect(body.error?.message).toMatch(/Sauvegarder \+ relire/);

    // 3. Vérifier que l'alerte est affichée à l'écran avec le message guidant
    //    NB : role="alert" matche aussi __next-route-announcer__ (a11y Next.js),
    //    on cible la classe spécifique du composant ContentStudioClient.
    const errorAlert = page.locator('p[role="alert"].bg-red-50');
    await expect(errorAlert).toBeVisible({ timeout: 5_000 });
    await expect(errorAlert).toContainText(/visuel doit être associé/i);
  });
});
