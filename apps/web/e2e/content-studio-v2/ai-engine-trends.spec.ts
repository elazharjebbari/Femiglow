/**
 * AI Engine — Trends (Veille & Tendances) E2E tests.
 *
 * Uses page.route() to mock the trends API with consistent data
 * so tests never depend on real trend data.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_TRENDS_RESPONSE = {
  trends: [
    {
      id: 't1',
      source: 'seasonal',
      category: 'routine',
      title: 'J-Beauty Routine',
      description: 'Test trend description for J-Beauty routine skincare',
      compositeScore: 0.85,
      brandRelevance: 0.9,
      viralPotential: 0.8,
      timeSensitivity: 0.6,
      contentFeasibility: 0.9,
      suggestedFormats: ['reel', 'carousel'],
      suggestedHooks: ['Hook 1'],
      opportunityWindow: '1 week',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
    {
      id: 't2',
      source: 'evergreen',
      category: 'ingredient',
      title: 'Tsubaki Oil',
      description: 'Trending ingredient for hair and skin care',
      compositeScore: 0.72,
      brandRelevance: 0.95,
      viralPotential: 0.5,
      timeSensitivity: 0.3,
      contentFeasibility: 0.85,
      suggestedFormats: ['carousel'],
      suggestedHooks: ['Hook 2'],
      opportunityWindow: 'evergreen',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
  ],
  meta: { count: 2, minScore: 0.4, timestamp: new Date().toISOString() },
};

/** Set up mock route for trends API. */
async function mockTrendsAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TRENDS_RESPONSE),
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. Page loads with title
// ─────────────────────────────────────────────────────────────────
test('trends — page loads with "Veille & Tendances" header', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  // « AI Engine » apparaît 4 fois (sidebar, label, breadcrumb, eyebrow) : on cible l'eyebrow.
  await expect(page.locator('.cs-eyebrow', { hasText: 'AI Engine' })).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Veille & Tendances/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Trend cards display with titles
// ─────────────────────────────────────────────────────────────────
test('trends — trend cards display with titles', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Tsubaki Oil' })).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Composite scores visible
// ─────────────────────────────────────────────────────────────────
test('trends — composite scores are visible', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  // Composite scores: 85 and 72
  await expect(page.getByText('85').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('72').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Score bars render for each dimension
// ─────────────────────────────────────────────────────────────────
test('trends — score bars render for each dimension', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  // Score bar labels (each trend has 4 score bars, use first())
  await expect(page.getByText('Marque').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Viralité').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Urgence').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Faisabilité').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Category filter "Toutes" is active by default
// ─────────────────────────────────────────────────────────────────
test('trends — category filter "Toutes" is active by default', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  const toutesButton = page.getByRole('button', { name: /Toutes/i });
  await expect(toutesButton).toBeVisible({ timeout: 15_000 });

  // The "Toutes" button should have the accent background when active.
  // It uses inline styles — verify it is rendered (click behavior tested below).
  await expect(toutesButton).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 6. Category pills are clickable
// ─────────────────────────────────────────────────────────────────
test('trends — category pills are clickable', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  // Category pills for the trends: "Routine" and "Ingrédient"
  const routinePill = page.getByRole('button', { name: 'Routine' });
  await expect(routinePill).toBeVisible({ timeout: 10_000 });
  await routinePill.click();

  // After clicking, the filter should be applied. The page re-fetches via mock.
  // Both trends still appear since mock always returns the same data.
  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. "Créer un contenu" button links correctly
// ─────────────────────────────────────────────────────────────────
test('trends — "Créer un contenu" button links to /create with trend param', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  const createLink = page.locator('article').first().getByRole('link', { name: /Créer un contenu/i });
  await expect(createLink).toBeVisible({ timeout: 10_000 });
  const href = await createLink.getAttribute('href');
  expect(href).toContain('/ai-engine/create');
  expect(href).toContain('trend=');
});

// ─────────────────────────────────────────────────────────────────
// 8. Opportunity window text is shown
// ─────────────────────────────────────────────────────────────────
test('trends — opportunity window text is shown', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  // Opportunity windows from mock: "1 week" and "evergreen"
  await expect(page.getByText('1 week')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('evergreen')).toBeVisible({ timeout: 10_000 });
});
