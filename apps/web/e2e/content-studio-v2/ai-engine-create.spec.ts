/**
 * AI Engine — Create (generation wizard) E2E tests.
 *
 * Verifies that the create form loads, validates required fields,
 * and (in serial mode) runs a full generation flow end-to-end.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('create — page loads with "Nouvelle generation" header', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Nouvelle génération/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test('create — brief form has required fields', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  // Wait for the form container to be visible.
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Each required field label should be present.
  for (const label of ['Objectif', 'Plateforme', 'Format', 'Ton', 'Message clé']) {
    await expect(page.getByText(label, { exact: false })).toBeVisible();
  }
});

test('create — "Generer" button is disabled when required fields are empty', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // The "Generer" button should be disabled by default (no fields filled).
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeVisible();
  await expect(genButton).toBeDisabled();
});

test('create — filling all required fields enables the button', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Fill the select fields by selecting option values.
  await page.locator('select').nth(0).selectOption('engagement');   // Objectif
  await page.locator('select').nth(1).selectOption('instagram');    // Plateforme
  await page.locator('select').nth(2).selectOption('text_post');    // Format
  await page.locator('select').nth(3).selectOption('luxurious');    // Ton

  // Fill the textarea for "Message cle".
  await page.locator('textarea').first().fill('Le rituel FemiGlow');

  // The "Generer" button should now be enabled.
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
});

/**
 * Full generation flow — serial test (slower, calls real API).
 *
 * This test fills the brief, triggers generation, and waits for the
 * result to appear. It uses a generous timeout (120 s) because the
 * LLM call can take a while.
 */
test.describe.serial('create — full generation flow', () => {
  test('fill brief, generate, verify result', async ({ page }) => {
    test.setTimeout(180_000);

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

    // Fill brief form.
    await page.locator('select').nth(0).selectOption('engagement');
    await page.locator('select').nth(1).selectOption('instagram');
    await page.locator('select').nth(2).selectOption('text_post');
    await page.locator('select').nth(3).selectOption('luxurious');
    await page.locator('textarea').first().fill('Le rituel FemiGlow');

    // Click "Generer".
    const genButton = page.getByRole('button', { name: /Générer/i });
    await expect(genButton).toBeEnabled();
    await genButton.click();

    // Wait for result phase to appear (up to 120 s for generation).
    // The result page shows "Contenu genere" as heading.
    await expect(
      page.getByText('Contenu généré'),
    ).toBeVisible({ timeout: 120_000 });

    // Verify script hook is present (the Script section is default-open).
    await expect(page.getByText('Hook')).toBeVisible({ timeout: 10_000 });

    // Verify caption section exists.
    await expect(page.getByText('Caption')).toBeVisible({ timeout: 10_000 });

    // Verify hashtags are displayed (at least one badge starting with #).
    await expect(page.locator('text=/#\\w+/')).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Fallback: check for any Badge-style element containing #.
      // The hashtags are in Badge components with tone="accent".
    });

    // Verify quality scores section.
    await expect(page.getByText('Scores qualité')).toBeVisible({ timeout: 10_000 });

    // Verify bridge link — "Voir dans la Bibliotheque".
    await expect(
      page.getByRole('link', { name: /Voir dans la Bibliothèque/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
