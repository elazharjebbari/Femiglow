/**
 * AI Engine — Dashboard E2E tests.
 *
 * Verifies that the dashboard page loads correctly, shows provider
 * status cards, the "Nouvelle generation IA" CTA, and the sidebar
 * sub-navigation.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('dashboard — page loads and shows "AI Engine" header', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // The eyebrow text says "AI Engine" and the h1 says "Tableau de bord".
  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible({ timeout: 15_000 });
});

test('dashboard — provider status cards are visible', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // At minimum the "Texte / LLM" provider card should appear (active or
  // loading state both show the label). The dashboard renders 4 cards for
  // text, image, video, tts.
  await expect(page.getByText('Texte / LLM')).toBeVisible({ timeout: 15_000 });
});

test('dashboard — "Nouvelle generation IA" button is visible and links to /create', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const ctaLink = page.getByRole('link', { name: /Nouvelle génération IA/i });
  await expect(ctaLink).toBeVisible({ timeout: 15_000 });
  await expect(ctaLink).toHaveAttribute('href', /\/ai-engine\/create/);
});

test('dashboard — sidebar shows AI Engine sub-navigation items', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // The sidebar sub-nav is scoped to `nav[aria-label="AI Engine"]`.
  const subNav = page.locator('nav[aria-label="AI Engine"]');
  await expect(subNav).toBeVisible({ timeout: 15_000 });

  // Each sub-nav entry should be present.
  for (const label of ['Générer', 'Veille', 'Config', 'Métriques']) {
    await expect(subNav.getByText(label)).toBeVisible({ timeout: 5_000 });
  }
});
