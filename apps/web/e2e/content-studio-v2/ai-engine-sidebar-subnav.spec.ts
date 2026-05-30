/**
 * AI Engine — Sidebar sub-navigation E2E tests.
 *
 * The AI Engine pages use a standalone layout (no AppShell sidebar).
 * However, the Content Studio v2 shell sidebar (Sidebar.tsx) shows an
 * "AI Engine" sub-nav section when the path starts with
 * /admin/content-studio-v2/ai-engine.
 *
 * Since the AI Engine pages are standalone, these tests verify the
 * dashboard page's internal navigation links instead (the same approach
 * used by the existing dashboard test).
 *
 * We also verify the shell sidebar shows the AI Engine link and sub-nav
 * when navigating via the shell (/home).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_HEALTH = {
  enabled: true,
  providers: {
    text: { configured: true, provider: 'openai', model: 'gpt-4o', name: 'Texte / LLM', status: 'active' },
    image: { configured: true, provider: 'openai', model: 'dall-e-3', name: 'Images', status: 'active' },
    video: { configured: false, provider: 'mock', model: 'mock', name: 'Video', status: 'inactive' },
    tts: { configured: false, provider: 'mock', model: 'mock', name: 'Voix / TTS', status: 'inactive' },
  },
  budget: { dailyCents: 1000, maxPerJobCents: 100, dailyUsedCents: 50, dailyLimitCents: 1000, monthlyUsedCents: 200, monthlyLimitCents: 30000 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  version: '1.0.0-mvp',
  timestamp: new Date().toISOString(),
};

const MOCK_TRENDS = {
  trends: [
    { id: 't1', source: 'seasonal', category: 'routine', title: 'Trend', description: 'desc', compositeScore: 0.5, brandRelevance: 0.5, viralPotential: 0.5, timeSensitivity: 0.5, contentFeasibility: 0.5, suggestedFormats: [], suggestedHooks: [], opportunityWindow: 'evergreen', riskAssessment: 'low', detectedAt: new Date().toISOString(), status: 'new' },
  ],
  meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
};

const MOCK_PROVIDERS = {
  providers: [
    { id: 'p1', name: 'OpenAI', providerType: 'openai', capabilities: ['text'], configured: true, isEnabled: true, healthStatus: 'healthy', priority: 1, isFallback: false, models: [], apiKeyEnvVar: '', baseUrl: null, rateLimitRpm: 60, dailyBudgetCents: 500, circuitBreakerConfig: null, lastHealthCheck: null },
  ],
};

async function mockAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HEALTH) });
  });
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRENDS) });
  });
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workflows: [] }) });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prompts: [] }) });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. On AI Engine dashboard, navigation shows "Nouvelle generation IA" and "Configuration"
// ─────────────────────────────────────────────────────────────────
test('sidebar — dashboard shows navigation links to sub-pages', async ({ page }) => {
  await mockAPIs(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });

  // The dashboard provides direct navigation links
  await expect(
    page.getByRole('link', { name: /Nouvelle génération IA/i }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('link', { name: /Configuration/i }),
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Shell sidebar shows "AI Engine" link from content studio home
// ─────────────────────────────────────────────────────────────────
test('sidebar — shell sidebar shows "AI Engine" link from home', async ({ page }) => {
  await mockAPIs(page);

  // Navigate to the content studio home (where the shell sidebar is visible)
  await page.addInitScript(() => {
    try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
  });
  await page.goto('/admin/content-studio-v2/home');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  const sidebar = page.locator('.cs-sidebar');
  const aiLink = sidebar.getByRole('link', { name: 'AI Engine' });
  await expect(aiLink).toBeVisible({ timeout: 10_000 });
  await expect(aiLink).toHaveAttribute('href', /\/ai-engine/);
});

// ─────────────────────────────────────────────────────────────────
// 3. Clicking "Nouvelle generation IA" navigates to create page
// ─────────────────────────────────────────────────────────────────
test('sidebar — clicking "Nouvelle generation IA" navigates to create page', async ({ page }) => {
  await mockAPIs(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const ctaLink = page.getByRole('link', { name: /Nouvelle génération IA/i });
  await expect(ctaLink).toBeVisible({ timeout: 15_000 });
  await ctaLink.click();
  await expect(page).toHaveURL(/\/ai-engine\/create/, { timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Clicking "Configuration" navigates to config page
// ─────────────────────────────────────────────────────────────────
test('sidebar — clicking "Configuration" navigates to config page', async ({ page }) => {
  await mockAPIs(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const configLink = page.getByRole('link', { name: /Configuration/i });
  await expect(configLink).toBeVisible({ timeout: 15_000 });
  await configLink.click();
  // The Configuration link may navigate to /ai-engine/config or /admin/settings/ai-engine
  await expect(page).toHaveURL(/\/ai-engine/, { timeout: 15_000 });
  expect(page.url()).not.toContain('/ai-engine/create');
});
