/**
 * AI Engine — Sidebar Navigation & Sub-navigation E2E tests.
 *
 * Verifies the Content Studio v2 shell sidebar behaviour when browsing
 * AI Engine pages: main nav items, AI Engine subnav section, active-page
 * highlighting, deep-link states, back-button behaviour, theme toggle,
 * and logo link.
 *
 * All API calls are intercepted with page.route() so no real backend is
 * required.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ── Mock data ────────────────────────────────────────────────────

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-sn-1',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image'],
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

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-sn-1',
      name: 'Nav Collection',
      slug: 'nav-collection',
      description: 'Test collection for sidebar nav',
      category: 'brand',
      documentCount: 5,
      chunkCount: 40,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
  ],
};

const MOCK_TRENDS = {
  trends: [
    {
      id: 'tsn-1',
      source: 'seasonal',
      category: 'routine',
      title: 'Nav Trend',
      description: 'Trend for nav testing',
      compositeScore: 0.8,
      brandRelevance: 0.9,
      viralPotential: 0.7,
      timeSensitivity: 0.5,
      contentFeasibility: 0.85,
      suggestedFormats: ['reel'],
      suggestedHooks: ['Hook'],
      opportunityWindow: '1 week',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
  ],
  meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
};

const MOCK_ANALYTICS = {
  overview: {
    generationsToday: 2,
    generationsWeek: 10,
    generationsMonth: 40,
    costTodayCents: 15,
    costWeekCents: 80,
    costMonthCents: 300,
    avgQualityScore: 0.82,
    successRate: 92,
    errorRate: 8,
  },
  nodeMetrics: [],
  costByProvider: [],
  costByNode: [],
  recentJobs: [],
};

// ── Shared mock setup ────────────────────────────────────────────

async function mockAllAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
  });
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS) });
  });
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRENDS) });
  });
  await page.route('**/api/admin/ai-engine/analytics*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYTICS) });
  });
}

// ── Tests ────────────────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
  });

  /* ----------------------------------------------------------------
   * Main sidebar nav items
   * ---------------------------------------------------------------- */

  test('sidebar shows 5 main nav items', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });

    const mainNav = sidebar.locator('nav[aria-label="Modes du Studio"]');
    await expect(mainNav).toBeVisible({ timeout: 10_000 });

    const navLinks = mainNav.locator('a.cs-nav-item');
    await expect(navLinks).toHaveCount(5);
  });

  test('sidebar main nav shows correct labels', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    const labels = ['Accueil', 'Création', 'Bibliothèque', 'Planning', 'AI Engine'];
    for (const label of labels) {
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('AI Engine link navigates to dashboard', async ({ page }) => {
    // Start from Content Studio home
    await page.addInitScript(() => {
      try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
    });
    await page.goto('/admin/content-studio-v2/home');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    const aiLink = sidebar.getByRole('link', { name: 'AI Engine' });
    await expect(aiLink).toBeVisible({ timeout: 10_000 });

    await aiLink.click();
    await expect(page).toHaveURL(/\/ai-engine/, { timeout: 15_000 });
  });

  /* ----------------------------------------------------------------
   * AI Engine sub-nav
   * ---------------------------------------------------------------- */

  test('AI Engine subnav appears on AI Engine pages', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    const subnav = sidebar.locator('nav[aria-label="AI Engine"]');
    await expect(subnav).toBeVisible({ timeout: 10_000 });
  });

  test('subnav shows 5 items: Générer, Connaissances, Veille, Métriques, Config', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const subnavLabels = ['Générer', 'Connaissances', 'Veille', 'Métriques', 'Config'];
    for (const label of subnavLabels) {
      await expect(subnav.getByText(label, { exact: true })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('subnav links have correct href values', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const expectedHrefs: Record<string, string> = {
      'Générer': '/admin/content-studio-v2/ai-engine/create',
      'Connaissances': '/admin/content-studio-v2/ai-engine/knowledge',
      'Veille': '/admin/content-studio-v2/ai-engine/trends',
      'Métriques': '/admin/content-studio-v2/ai-engine/analytics',
      'Config': '/admin/content-studio-v2/ai-engine/config',
    };

    for (const [label, href] of Object.entries(expectedHrefs)) {
      const link = subnav.getByRole('link', { name: label });
      await expect(link).toHaveAttribute('href', href);
    }
  });

  test('active page highlighted in subnav on config page', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const configLink = subnav.getByRole('link', { name: 'Config' });
    await expect(configLink).toHaveAttribute('aria-current', 'page');
  });

  /* ----------------------------------------------------------------
   * Navigation flows via subnav clicks
   * ---------------------------------------------------------------- */

  test('clicking Connaissances navigates to knowledge page', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Connaissances' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/knowledge/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Base de connaissances/i })).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Config navigates to config page', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Config' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/config/, { timeout: 15_000 });
    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });
  });

  test('clicking Générer navigates to create page', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Générer' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/create/, { timeout: 15_000 });
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Métriques navigates to analytics page', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Métriques' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/analytics/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Analytiques/i })).toBeVisible({ timeout: 15_000 });
  });

  test('clicking Veille navigates to trends page', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Veille' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/trends/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Veille & Tendances/i })).toBeVisible({ timeout: 15_000 });
  });

  /* ----------------------------------------------------------------
   * Subnav not visible outside AI Engine
   * ---------------------------------------------------------------- */

  test('subnav hidden on non-AI Engine pages', async ({ page }) => {
    await page.addInitScript(() => {
      try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
    });
    await page.goto('/admin/content-studio-v2/home');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await expect(subnav).not.toBeVisible();
  });

  /* ----------------------------------------------------------------
   * Back button on sub-pages
   * ---------------------------------------------------------------- */

  test('back button on config page works', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    const backLink = page.locator('a[href="/admin/content-studio-v2/ai-engine"]').first();
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
  });

  test('back button on knowledge page works', async ({ page }) => {
    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    await expect(page.getByRole('heading', { name: /Base de connaissances/i })).toBeVisible({ timeout: 15_000 });

    const backLink = page.locator('a[href="/admin/content-studio-v2/ai-engine"]').first();
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await backLink.click();
    await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
  });

  /* ----------------------------------------------------------------
   * Deep-link subnav active states
   * ---------------------------------------------------------------- */

  test('deep link to config page shows correct subnav active state', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const configLink = subnav.getByRole('link', { name: 'Config' });
    await expect(configLink).toHaveAttribute('aria-current', 'page');

    // Other subnav items should NOT have aria-current
    for (const label of ['Générer', 'Connaissances', 'Veille', 'Métriques']) {
      const link = subnav.getByRole('link', { name: label });
      const ariaCurrent = await link.getAttribute('aria-current');
      expect(ariaCurrent).toBeNull();
    }
  });

  test('deep link to knowledge page shows correct subnav active state', async ({ page }) => {
    await gotoAIEngine(page, 'knowledge');
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const knowledgeLink = subnav.getByRole('link', { name: 'Connaissances' });
    await expect(knowledgeLink).toHaveAttribute('aria-current', 'page');
  });

  test('deep link to trends page shows correct subnav active state', async ({ page }) => {
    await gotoAIEngine(page, 'trends');
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    const trendsLink = subnav.getByRole('link', { name: 'Veille' });
    await expect(trendsLink).toHaveAttribute('aria-current', 'page');
  });

  /* ----------------------------------------------------------------
   * Browser back button
   * ---------------------------------------------------------------- */

  test('browser back button preserves state', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    // Navigate to config via subnav
    const subnav = page.locator('nav[aria-label="AI Engine"]');
    await subnav.getByRole('link', { name: 'Config' }).click();
    await expect(page).toHaveURL(/\/ai-engine\/config/, { timeout: 15_000 });
    await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });

    // The shell should still be visible, not broken
    await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 10_000 });
  });

  /* ----------------------------------------------------------------
   * Theme toggle and legacy link
   * ---------------------------------------------------------------- */

  test('sidebar shows theme toggle', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    // ThemeToggle is a button at the bottom of the sidebar
    const themeToggle = sidebar.locator('button').filter({ hasText: /clair|sombre|dark|light/i }).first();
    const toggleArea = sidebar.locator('.px-3.py-3').first();
    // Either the toggle button itself or the container should be visible
    const toggleVisible = await themeToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    const areaVisible = await toggleArea.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(toggleVisible || areaVisible).toBe(true);
  });

  test('sidebar shows legacy studio link', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    const legacyLink = sidebar.getByRole('link', { name: /Ancien/i });
    await expect(legacyLink).toBeVisible({ timeout: 10_000 });
    await expect(legacyLink).toHaveAttribute('href', '/admin/content-studio-legacy');
  });

  test('logo links to home', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const sidebar = page.locator('.cs-sidebar');
    // The logo is the first link containing "Femiglow" text
    const logoLink = sidebar.getByRole('link', { name: /Femiglow/i }).first();
    await expect(logoLink).toBeVisible({ timeout: 10_000 });
    await expect(logoLink).toHaveAttribute('href', '/admin/content-studio-v2/home');
  });

  /* ----------------------------------------------------------------
   * Subnav label header
   * ---------------------------------------------------------------- */

  test('subnav shows "AI ENGINE" section header', async ({ page }) => {
    await gotoAIEngine(page);
    ensureAuthOrSkip(page);

    const subnav = page.locator('nav[aria-label="AI Engine"]');
    // The uppercase label "AI Engine" in the subnav header
    const sectionHeader = subnav.locator('span').filter({ hasText: 'AI Engine' }).first();
    await expect(sectionHeader).toBeVisible({ timeout: 10_000 });
  });
});
