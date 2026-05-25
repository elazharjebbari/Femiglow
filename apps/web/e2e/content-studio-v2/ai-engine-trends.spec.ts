/**
 * AI Engine — Trends (Veille & Tendances) E2E tests.
 *
 * Verifies that the trends page loads, displays trend cards with scores,
 * shows category filter buttons, and that "Creer un contenu" buttons link
 * to the create page with trend params.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('trends — page loads with "Veille & Tendances" header', async ({ page }) => {
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Veille & Tendances/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test('trends — trend cards are displayed with scores', async ({ page }) => {
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  // Wait for loading to finish: either trend cards appear or the empty state.
  // Trends are rendered as <article> elements.
  const firstArticle = page.locator('article').first();
  const emptyState = page.getByText('Aucune tendance détectée');

  // Wait for either state.
  await expect(
    firstArticle.or(emptyState),
  ).toBeVisible({ timeout: 30_000 });

  // If trends exist, verify score bars are present.
  const articleCount = await page.locator('article').count();
  if (articleCount > 0) {
    // Each card has score bars (Marque, Viralite, Urgence, Faisabilite).
    await expect(page.getByText('Marque').first()).toBeVisible();
    await expect(page.getByText('Viralité').first()).toBeVisible();
  }
});

test('trends — category filter buttons are visible', async ({ page }) => {
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  // The "Toutes" filter button is always visible.
  await expect(page.getByRole('button', { name: /Toutes/i })).toBeVisible({ timeout: 15_000 });
});

test('trends — "Creer un contenu" buttons link to /create with trend param', async ({ page }) => {
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  // Wait for trends to load.
  const firstArticle = page.locator('article').first();
  const emptyState = page.getByText('Aucune tendance détectée');

  await expect(firstArticle.or(emptyState)).toBeVisible({ timeout: 30_000 });

  const articleCount = await page.locator('article').count();
  if (articleCount > 0) {
    // The first "Creer un contenu" link inside an article should point to /create?trend=.
    const createLink = page.locator('article').first().getByRole('link', { name: /Créer un contenu/i });
    await expect(createLink).toBeVisible({ timeout: 10_000 });
    const href = await createLink.getAttribute('href');
    expect(href).toContain('/ai-engine/create');
    expect(href).toContain('trend=');
  } else {
    // No trends — skip this assertion gracefully.
    test.skip(true, 'No trends available to test the create-from-trend link.');
  }
});
