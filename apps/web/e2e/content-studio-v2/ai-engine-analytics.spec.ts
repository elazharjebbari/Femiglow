/**
 * AI Engine — Analytics page E2E tests.
 *
 * Uses page.route() to mock the analytics API for deterministic tests.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_ANALYTICS_RESPONSE = {
  overview: {
    generationsToday: 5,
    generationsWeek: 28,
    generationsMonth: 112,
    costTodayCents: 45,
    costWeekCents: 250,
    costMonthCents: 980,
    avgQualityScore: 0.82,
    successRate: 94.5,
    errorRate: 5.5,
  },
  nodeMetrics: [
    {
      nodeId: 'parseBrief',
      label: 'Analyse brief',
      provider: 'openai',
      avgLatencyMs: 1200,
      avgCostCents: 2,
      totalInvocations: 112,
      errorCount: 3,
      errorRate: 2.7,
      status: 'healthy',
    },
    {
      nodeId: 'generateScript',
      label: 'Script',
      provider: 'openai',
      avgLatencyMs: 3500,
      avgCostCents: 8,
      totalInvocations: 110,
      errorCount: 1,
      errorRate: 0.9,
      status: 'healthy',
    },
  ],
  costByProvider: [
    { provider: 'openai', costCents: 850, count: 220 },
    { provider: 'anthropic', costCents: 130, count: 12 },
  ],
  costByNode: [
    { nodeName: 'parseBrief', costCents: 200, count: 112 },
    { nodeName: 'generateScript', costCents: 400, count: 110 },
    { nodeName: 'generateCaption', costCents: 250, count: 105 },
  ],
  recentJobs: [
    {
      id: 'job-001',
      status: 'completed',
      platform: 'instagram',
      format: 'reel',
      contentType: 'video',
      totalCostCents: '15',
      durationMs: 8500,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'job-002',
      status: 'failed',
      platform: 'tiktok',
      format: 'carousel',
      contentType: 'image',
      totalCostCents: '5',
      durationMs: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
};

/** Set up mock route for analytics API. */
async function mockAnalyticsAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/analytics*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ANALYTICS_RESPONSE),
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. Page loads with "Analytiques" title
// ─────────────────────────────────────────────────────────────────
test('analytics — page loads with "Analytiques" title', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Analytiques/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. KPI cards show
// ─────────────────────────────────────────────────────────────────
test('analytics — KPI cards show (Generations, Cout, Qualite, Succes)', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  // Wait for data to load (KPI cards appear)
  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Cout total (mois)')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Qualite moyenne')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Taux de succes')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Period selector has 3 options
// ─────────────────────────────────────────────────────────────────
test('analytics — period selector has 3 options', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole('button', { name: 'Dernieres 24h' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: '7 jours' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: '30 jours' })).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Recent generations table renders
// ─────────────────────────────────────────────────────────────────
test('analytics — recent generations table renders', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });

  // Recent jobs section heading
  await expect(page.getByText('Generations recentes')).toBeVisible({ timeout: 10_000 });

  // Table headers
  await expect(page.getByText('Statut')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Plateforme')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Cost breakdown sections visible
// ─────────────────────────────────────────────────────────────────
test('analytics — cost breakdown sections visible', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });

  // Cost by provider and cost by node sections
  await expect(page.getByText('Cout par fournisseur')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Cout par noeud')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Link to graph viewer present
// ─────────────────────────────────────────────────────────────────
test('analytics — link to graph viewer present', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'analytics');
  ensureAuthOrSkip(page);

  await expect(page.getByText("Generations aujourd'hui")).toBeVisible({ timeout: 20_000 });

  // The "Graphe" button links to /graph (may appear in multiple places)
  const graphLink = page.locator('a[href*="/graph"]').first();
  await expect(graphLink).toBeVisible({ timeout: 10_000 });
});
