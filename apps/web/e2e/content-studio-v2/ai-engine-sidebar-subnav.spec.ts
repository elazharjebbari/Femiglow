/**
 * AI Engine — Sidebar sub-navigation E2E tests.
 *
 * Tests that the sidebar sub-navigation section appears when navigating
 * to AI Engine pages. The sidebar shows an "AI Engine" section label
 * with links to Generer, Veille, Metriques, Config.
 *
 * The sub-nav is rendered conditionally when the pathname starts with
 * /admin/content-studio-v2/ai-engine (see Sidebar.tsx).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function mockHealthAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true }),
    });
  });
}

async function mockConfigAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [{ id: 'p1', name: 'OpenAI', providerType: 'openai', capabilities: ['text'], configured: true, isEnabled: true, healthStatus: 'healthy', priority: 1, isFallback: false, models: [], apiKeyEnvVar: '', baseUrl: null, rateLimitRpm: 60, dailyBudgetCents: 500, circuitBreakerConfig: null, lastHealthCheck: null }],
      }),
    });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workflows: [] }),
    });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ prompts: [] }),
    });
  });
}

async function mockTrendsAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trends: [{ id: 't1', source: 'seasonal', category: 'routine', title: 'Trend', description: 'desc', compositeScore: 0.5, brandRelevance: 0.5, viralPotential: 0.5, timeSensitivity: 0.5, contentFeasibility: 0.5, suggestedFormats: [], suggestedHooks: [], opportunityWindow: 'evergreen', riskAssessment: 'low', detectedAt: new Date().toISOString(), status: 'new' }],
        meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
      }),
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. On AI Engine dashboard, sidebar shows "AI Engine" section label
// ─────────────────────────────────────────────────────────────────
test('sidebar — shows "AI Engine" section label on dashboard', async ({ page }) => {
  await mockHealthAPI(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const sidebar = page.locator('.cs-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 15_000 });

  // The sub-nav has aria-label="AI Engine" and a visible label span
  const aiEngineNav = sidebar.locator('nav[aria-label="AI Engine"]');
  await expect(aiEngineNav).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Sub-nav shows "Generer", "Veille", "Metriques", "Config" links
// ─────────────────────────────────────────────────────────────────
test('sidebar — sub-nav shows all 4 AI Engine links', async ({ page }) => {
  await mockHealthAPI(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const sidebar = page.locator('.cs-sidebar');
  const aiNav = sidebar.locator('nav[aria-label="AI Engine"]');
  await expect(aiNav).toBeVisible({ timeout: 10_000 });

  // Check for all 4 sub-nav links
  await expect(aiNav.getByText('Générer')).toBeVisible({ timeout: 5_000 });
  await expect(aiNav.getByText('Veille')).toBeVisible({ timeout: 5_000 });
  await expect(aiNav.getByText('Métriques')).toBeVisible({ timeout: 5_000 });
  await expect(aiNav.getByText('Config')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Clicking "Veille" navigates to trends page
// ─────────────────────────────────────────────────────────────────
test('sidebar — clicking "Veille" navigates to trends page', async ({ page }) => {
  await mockHealthAPI(page);
  await mockTrendsAPI(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const sidebar = page.locator('.cs-sidebar');
  const aiNav = sidebar.locator('nav[aria-label="AI Engine"]');
  await expect(aiNav).toBeVisible({ timeout: 10_000 });

  await aiNav.getByText('Veille').click();
  await expect(page).toHaveURL(/\/ai-engine\/trends/, { timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Clicking "Config" navigates to config page
// ─────────────────────────────────────────────────────────────────
test('sidebar — clicking "Config" navigates to config page', async ({ page }) => {
  await mockHealthAPI(page);
  await mockConfigAPIs(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const sidebar = page.locator('.cs-sidebar');
  const aiNav = sidebar.locator('nav[aria-label="AI Engine"]');
  await expect(aiNav).toBeVisible({ timeout: 10_000 });

  await aiNav.getByText('Config').click();
  await expect(page).toHaveURL(/\/ai-engine\/config/, { timeout: 15_000 });
});
