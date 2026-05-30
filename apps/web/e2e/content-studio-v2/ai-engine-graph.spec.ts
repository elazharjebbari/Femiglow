/**
 * AI Engine — Graph Viewer E2E tests.
 *
 * Uses page.route() to mock the analytics API with node metrics data.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_ANALYTICS_RESPONSE = {
  overview: {
    generationsToday: 5,
    generationsWeek: 28,
    generationsMonth: 120,
    costTodayCents: 150,
    costWeekCents: 850,
    costMonthCents: 3200,
    avgQualityScore: 0.87,
    successRate: 94.2,
    errorRate: 5.8,
  },
  nodeMetrics: [
    {
      nodeId: 'parseBrief',
      label: 'Analyse du brief',
      provider: 'openai',
      avgLatencyMs: 1200,
      avgCostCents: 8,
      totalInvocations: 120,
      errorCount: 2,
      errorRate: 1.7,
      status: 'healthy',
    },
    {
      nodeId: 'enrichKnowledge',
      label: 'Enrichissement savoir',
      provider: 'openai',
      avgLatencyMs: 800,
      avgCostCents: 5,
      totalInvocations: 118,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'enrichTrends',
      label: 'Enrichissement tendances',
      provider: 'openai',
      avgLatencyMs: 950,
      avgCostCents: 6,
      totalInvocations: 118,
      errorCount: 1,
      errorRate: 0.8,
      status: 'healthy',
    },
    {
      nodeId: 'generateScript',
      label: 'Generation script',
      provider: 'anthropic',
      avgLatencyMs: 3500,
      avgCostCents: 25,
      totalInvocations: 117,
      errorCount: 3,
      errorRate: 2.6,
      status: 'healthy',
    },
    {
      nodeId: 'generateVideo',
      label: 'Generation video',
      provider: 'runway',
      avgLatencyMs: 12000,
      avgCostCents: 80,
      totalInvocations: 35,
      errorCount: 5,
      errorRate: 14.3,
      status: 'degraded',
    },
    {
      nodeId: 'generateVoiceover',
      label: 'Voix off',
      provider: 'elevenlabs',
      avgLatencyMs: 2200,
      avgCostCents: 15,
      totalInvocations: 30,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'generateMusic',
      label: 'Musique',
      provider: 'elevenlabs',
      avgLatencyMs: 1800,
      avgCostCents: 10,
      totalInvocations: 28,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'generateSubtitles',
      label: 'Sous-titres',
      provider: 'openai',
      avgLatencyMs: 600,
      avgCostCents: 3,
      totalInvocations: 28,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'generateImages',
      label: 'Generation images',
      provider: 'openai',
      avgLatencyMs: 8000,
      avgCostCents: 40,
      totalInvocations: 82,
      errorCount: 4,
      errorRate: 4.9,
      status: 'healthy',
    },
    {
      nodeId: 'generateCaption',
      label: 'Generation caption',
      provider: 'openai',
      avgLatencyMs: 1500,
      avgCostCents: 7,
      totalInvocations: 117,
      errorCount: 1,
      errorRate: 0.9,
      status: 'healthy',
    },
    {
      nodeId: 'compose',
      label: 'Composition',
      provider: 'internal',
      avgLatencyMs: 200,
      avgCostCents: 0,
      totalInvocations: 116,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'transcodeExport',
      label: 'Transcodage / Export',
      provider: 'internal',
      avgLatencyMs: 500,
      avgCostCents: 0,
      totalInvocations: 116,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'qualityCheck',
      label: 'Controle qualite',
      provider: 'openai',
      avgLatencyMs: 1100,
      avgCostCents: 4,
      totalInvocations: 116,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'moderate',
      label: 'Moderation',
      provider: 'openai',
      avgLatencyMs: 900,
      avgCostCents: 3,
      totalInvocations: 110,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'reviewGate',
      label: 'Revue humaine',
      provider: 'internal',
      avgLatencyMs: 0,
      avgCostCents: 0,
      totalInvocations: 108,
      errorCount: 0,
      errorRate: 0,
      status: 'healthy',
    },
    {
      nodeId: 'generateVariants',
      label: 'Generation variantes',
      provider: 'openai',
      avgLatencyMs: 2000,
      avgCostCents: 12,
      totalInvocations: 50,
      errorCount: 1,
      errorRate: 2.0,
      status: 'healthy',
    },
  ],
  costByProvider: [
    { provider: 'openai', costCents: 2000, count: 800 },
    { provider: 'anthropic', costCents: 900, count: 117 },
    { provider: 'elevenlabs', costCents: 250, count: 58 },
    { provider: 'runway', costCents: 50, count: 35 },
  ],
  costByNode: [
    { nodeName: 'generateScript', costCents: 900, count: 117 },
    { nodeName: 'generateImages', costCents: 800, count: 82 },
    { nodeName: 'generateVideo', costCents: 500, count: 35 },
  ],
  recentJobs: [],
};

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
// 1. Page loads with node cards visible
// ─────────────────────────────────────────────────────────────────
test('graph — page loads with node cards visible', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });
  // At least one node card should be visible
  await expect(page.getByText('Analyse du brief')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Summary bar shows node count
// ─────────────────────────────────────────────────────────────────
test('graph — summary bar shows node count', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Noeuds:')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Node cards display French labels
// ─────────────────────────────────────────────────────────────────
test('graph — node cards display French labels', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  for (const label of [
    'Analyse du brief',
    'Enrichissement savoir',
    'Generation script',
    'Generation caption',
    'Controle qualite',
  ]) {
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────
// 4. Clicking a node card expands details
// ─────────────────────────────────────────────────────────────────
test('graph — clicking a node card expands details', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  // Click on "Analyse du brief" node card (role=button)
  const nodeCard = page.locator('div[role="button"]', { hasText: 'Analyse du brief' }).first();
  await expect(nodeCard).toBeVisible({ timeout: 10_000 });
  await nodeCard.click();

  // Expanded details should show "Fournisseur"
  await expect(page.getByText('Fournisseur')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Expanded details show provider and latency
// ─────────────────────────────────────────────────────────────────
test('graph — expanded details show provider and latency', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  const nodeCard = page.locator('div[role="button"]', { hasText: 'Analyse du brief' }).first();
  await nodeCard.click();

  await expect(page.getByText('Fournisseur')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('openai')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Latence moy.')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Conditional edges section is visible
// ─────────────────────────────────────────────────────────────────
test('graph — conditional edges section is visible', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Routages conditionnels')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Video branch nodes are displayed
// ─────────────────────────────────────────────────────────────────
test('graph — video branch nodes are displayed', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  for (const label of ['Generation video', 'Voix off', 'Musique', 'Sous-titres']) {
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 10_000 });
  }
});

// ─────────────────────────────────────────────────────────────────
// 8. Back navigation works
// ─────────────────────────────────────────────────────────────────
test('graph — back navigation link is present', async ({ page }) => {
  await mockAnalyticsAPI(page);
  await gotoAIEngine(page, 'graph');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Visualisation du graphe LangGraph')).toBeVisible({ timeout: 15_000 });

  // ArrowLeft back link should navigate to ai-engine dashboard
  const backLink = page.locator('a[href="/admin/content-studio-v2/ai-engine"]').first();
  await expect(backLink).toBeVisible({ timeout: 10_000 });
});
