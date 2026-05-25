/**
 * AI Engine — Accessibility audit (axe-core) across all AI Engine pages.
 *
 * Uses page.route() to mock API calls so pages load data without real backends.
 * Asserts zero critical violations on each page.
 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

const MOCK_HEALTH = {
  enabled: true,
  providers: {
    text: { name: 'OpenAI', provider: 'openai', model: 'gpt-4o', status: 'active' },
    image: { name: 'DALL-E', provider: 'openai', model: 'dall-e-3', status: 'active' },
    video: { name: 'Runway', provider: 'runway', model: 'gen-3', status: 'inactive' },
    tts: { name: 'ElevenLabs', provider: 'elevenlabs', model: 'v2', status: 'active' },
  },
  budget: { dailyUsedCents: 150, dailyLimitCents: 1000, monthlyUsedCents: 3200, monthlyLimitCents: 20000 },
};

const MOCK_ANALYTICS = {
  overview: {
    generationsToday: 5, generationsWeek: 28, generationsMonth: 120,
    costTodayCents: 150, costWeekCents: 850, costMonthCents: 3200,
    avgQualityScore: 0.87, successRate: 94.2, errorRate: 5.8,
  },
  nodeMetrics: [],
  costByProvider: [],
  costByNode: [],
  recentJobs: [],
};

const MOCK_TRENDS = { trends: [], lastUpdated: new Date().toISOString() };

const MOCK_CONFIG = {
  text: { provider: 'openai', model: 'gpt-4o', apiKey: '***' },
  image: { provider: 'openai', model: 'dall-e-3', apiKey: '***' },
  budget: { dailyLimitCents: 1000, monthlyLimitCents: 20000 },
};

const MOCK_KNOWLEDGE = { collections: [] };

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HEALTH) });
  });
  await page.route('**/api/admin/ai-engine/analytics*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYTICS) });
  });
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRENDS) });
  });
  await page.route('**/api/admin/ai-engine/config*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONFIG) });
    } else {
      await route.continue();
    }
  });
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_KNOWLEDGE) });
  });
}

async function runA11yCheck(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .exclude('.cs-skeleton')
    .disableRules(['color-contrast'])
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === 'critical',
  );

  if (critical.length > 0) {
    const details = critical
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description}\n` +
          v.nodes.map((n) => `  - ${n.html.slice(0, 120)}`).join('\n'),
      )
      .join('\n\n');
    expect(critical, `A11y critical violations:\n${details}`).toHaveLength(0);
  }
}

const AI_ENGINE_PAGES = [
  { path: '/admin/content-studio-v2/ai-engine', name: 'dashboard' },
  { path: '/admin/content-studio-v2/ai-engine/create', name: 'create' },
  { path: '/admin/content-studio-v2/ai-engine/trends', name: 'trends' },
  { path: '/admin/content-studio-v2/ai-engine/config', name: 'config' },
  { path: '/admin/content-studio-v2/ai-engine/knowledge', name: 'knowledge' },
  { path: '/admin/content-studio-v2/ai-engine/analytics', name: 'analytics' },
  { path: '/admin/content-studio-v2/ai-engine/graph', name: 'graph' },
];

for (const pageDef of AI_ENGINE_PAGES) {
  test(`a11y — AI Engine ${pageDef.name} page has no critical violations`, async ({ page }) => {
    await setupMocks(page);

    // Clear chunk-reload flag
    await page.addInitScript(() => {
      try {
        window.sessionStorage.removeItem('femiglow:chunk-reload-attempted');
      } catch {}
    });

    await page.goto(pageDef.path);
    await page.waitForLoadState('domcontentloaded');
    ensureAuthOrSkip(page);

    // Wait for the page to stabilize
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // Try to wait for the v2 shell
    await page.locator('.cs-v2-shell').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

    await runA11yCheck(page);
  });
}
