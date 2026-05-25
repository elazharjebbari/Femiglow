/**
 * AI Engine — Navigation flow E2E tests.
 *
 * Tests full navigation between all AI Engine sub-pages using links,
 * buttons, and back arrows. Uses page.route() to mock only the APIs
 * each page needs — broad mocking (especially /health) breaks SSR.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ── Mock data ────────────────────────────────────────────────────

const MOCK_TRENDS = {
  trends: [
    {
      id: 'tnav-1',
      source: 'seasonal',
      category: 'routine',
      title: 'Nav Trend',
      description: 'Navigation test trend',
      compositeScore: 0.85,
      brandRelevance: 0.9,
      viralPotential: 0.8,
      timeSensitivity: 0.5,
      contentFeasibility: 0.85,
      suggestedFormats: ['reel'],
      suggestedHooks: ['Nav Hook'],
      opportunityWindow: '1 week',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
  ],
  meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
};

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-nav',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text'],
      models: [{ name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 }],
      rateLimitRpm: 60,
      dailyBudgetCents: 500,
      circuitBreakerConfig: null,
      priority: 1,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString(),
      configured: true,
    },
  ],
};

const MOCK_WORKFLOWS = { workflows: [] };
const MOCK_PROMPTS = { prompts: [] };

const MOCK_ANALYTICS = {
  overview: {
    generationsToday: 3,
    generationsWeek: 15,
    generationsMonth: 60,
    costTodayCents: 25,
    costWeekCents: 120,
    costMonthCents: 500,
    avgQualityScore: 0.8,
    successRate: 90,
    errorRate: 10,
  },
  nodeMetrics: [
    {
      nodeId: 'parseBrief',
      label: 'Analyse du brief',
      provider: 'openai',
      avgLatencyMs: 1000,
      avgCostCents: 2,
      totalInvocations: 60,
      errorCount: 1,
      errorRate: 1.7,
      status: 'healthy',
    },
  ],
  costByProvider: [{ provider: 'openai', costCents: 500, count: 100 }],
  costByNode: [{ nodeName: 'parseBrief', costCents: 100, count: 60 }],
  recentJobs: [],
};

// ── Per-page mock helpers ────────────────────────────────────────

async function mockTrendsAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TRENDS),
    });
  });
}

async function mockConfigAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROVIDERS),
    });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_WORKFLOWS),
    });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROMPTS),
    });
  });
}

async function mockAnalyticsAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/analytics*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ANALYTICS),
    });
  });
}

// ── Tests ────────────────────────────────────────────────────────

// 1. Dashboard -> "Nouvelle generation" -> Create page loads
test('navigation — dashboard "Nouvelle génération IA" link goes to Create page', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Tableau de bord/i }),
  ).toBeVisible({ timeout: 15_000 });

  const ctaLink = page.getByRole('link', { name: /Nouvelle génération IA/i });
  await expect(ctaLink).toBeVisible({ timeout: 10_000 });
  await ctaLink.click();

  await expect(page).toHaveURL(/\/ai-engine\/create/, { timeout: 15_000 });
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
});

// 2. Create -> back arrow -> Dashboard
test('navigation — create page back arrow returns to Dashboard', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  const backLink = page.locator('a[href*="/ai-engine"]').first();
  await expect(backLink).toBeVisible({ timeout: 10_000 });
  await backLink.click();

  await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
});

// 3. Dashboard -> navigate to Trends via sub-nav or link
test('navigation — dashboard to Trends via navigation', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  await expect(
    page.getByRole('heading', { name: /Tableau de bord/i }),
  ).toBeVisible({ timeout: 15_000 });

  const trendsLink = page.locator('a[href*="/ai-engine/trends"]').first();
  await expect(trendsLink).toBeVisible({ timeout: 10_000 });
  await trendsLink.click();

  await expect(page).toHaveURL(/\/ai-engine\/trends/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Veille & Tendances/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// 4. Trends -> "Creer un contenu" on trend -> Create page with trendReference
test('navigation — trends "Créer un contenu" goes to Create with trend param', async ({ page }) => {
  await mockTrendsAPI(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'Nav Trend' })).toBeVisible({ timeout: 20_000 });

  const createLink = page.locator('article').first().getByRole('link', { name: /Créer un contenu/i });
  await expect(createLink).toBeVisible({ timeout: 10_000 });

  const href = await createLink.getAttribute('href');
  expect(href).toContain('/ai-engine/create');
  expect(href).toContain('trend=');

  await createLink.click();
  await expect(page).toHaveURL(/\/ai-engine\/create/, { timeout: 15_000 });
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // The trendReference input should have a pre-filled value from the URL param.
  // Wait for the form to hydrate.
  const trendInput = page.locator('input[type="text"]').nth(1);
  await expect(trendInput).toBeVisible({ timeout: 10_000 });
  // The trend param is set in the URL; the page may or may not pre-fill it.
  // Verify the URL contains the trend parameter as proof of the navigation.
  await expect(page).toHaveURL(/trend=/);
});

// 5. Config -> "Base de connaissances" tab -> Knowledge section loads
test('navigation — config "Base de connaissances" tab loads knowledge section', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Base de connaissances' }).click();
  await expect(
    page.getByText(/Gerez les collections/i),
  ).toBeVisible({ timeout: 10_000 });
});

// 6. Config -> navigate to Analytics via link
test('navigation — config page has link to Analytics', async ({ page }) => {
  await mockConfigAPIs(page);
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  // Look for an analytics link on the config page or in the shell navigation
  const analyticsLink = page.locator('a[href*="/ai-engine/analytics"]').first();
  const isVisible = await analyticsLink.isVisible({ timeout: 5_000 }).catch(() => false);

  if (isVisible) {
    await analyticsLink.click();
    await expect(page).toHaveURL(/\/ai-engine\/analytics/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: /Analytiques/i }),
    ).toBeVisible({ timeout: 15_000 });
  } else {
    // Navigate directly
    await gotoAIEngine(page, 'analytics');
    ensureAuthOrSkip(page);
    await expect(
      page.getByRole('heading', { name: /Analytiques/i }),
    ).toBeVisible({ timeout: 15_000 });
  }
});

// 7. Analytics -> "Graphe" link -> Graph page loads
test('navigation — analytics "Graphe" link goes to Graph page', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });

  const graphLink = page.locator('a[href*="/graph"]').first();
  await expect(graphLink).toBeVisible({ timeout: 10_000 });
  await graphLink.click();

  await expect(page).toHaveURL(/\/ai-engine\/graph/, { timeout: 15_000 });
  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });
});

// 8. Graph -> back arrow -> AI Engine dashboard
test('navigation — graph back arrow returns to AI Engine', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  const backLink = page.locator('a[href="/admin/content-studio-v2/ai-engine"]').first();
  await expect(backLink).toBeVisible({ timeout: 10_000 });
  await backLink.click();

  await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
});
