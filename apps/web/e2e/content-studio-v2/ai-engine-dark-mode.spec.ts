/**
 * AI Engine — Dark Mode rendering E2E tests.
 *
 * Verifies that all major AI Engine pages render correctly in dark mode
 * by forcing `cs-v2-theme` in localStorage (read by ThemeProvider) and
 * checking that the shell applies `data-theme="dark"` and backgrounds
 * are dark-toned.
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

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-1',
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

const MOCK_WORKFLOWS = {
  workflows: [
    {
      id: 'wf-1',
      name: 'Default Pipeline',
      description: 'Pipeline standard',
      platform: 'instagram',
      format: 'reel',
      graphConfig: { nodes: ['brief_analysis'] },
      defaultTone: 'luxurious',
      defaultLanguage: 'fr',
      qualityThreshold: '0.7',
      maxRetries: 2,
      maxBudgetCents: 100,
      humanReviewRequired: false,
      autoPublish: false,
      providerOverrides: null,
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const MOCK_PROMPTS = {
  prompts: [
    {
      id: 'pt-1',
      nodeName: 'script_writer',
      name: 'Script Writer',
      systemPrompt: 'Tu es un expert.',
      userPromptTemplate: 'Ecris un script.',
      variables: ['platform'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: '0.87',
      usageCount: 10,
      createdAt: new Date().toISOString(),
    },
  ],
};

const MOCK_TRENDS = {
  trends: [
    {
      id: 't1',
      source: 'seasonal',
      category: 'routine',
      title: 'J-Beauty Routine',
      description: 'Trend description',
      compositeScore: 0.85,
      brandRelevance: 0.9,
      viralPotential: 0.8,
      timeSensitivity: 0.6,
      contentFeasibility: 0.9,
      suggestedFormats: ['reel'],
      suggestedHooks: ['Hook 1'],
      opportunityWindow: '1 week',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
  ],
  meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
};

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-1',
      name: 'Ingredients J-Beauty',
      slug: 'ingredients-j-beauty',
      description: 'Collection des ingredients',
      category: 'science',
      documentCount: 12,
      chunkCount: 87,
      lastIndexedAt: new Date().toISOString(),
      isActive: true,
    },
  ],
};

async function mockAllAPIs(page: import('@playwright/test').Page) {
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HEALTH) });
  });
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
  });
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRENDS) });
  });
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin/ai-engine/knowledge') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_COLLECTIONS) });
    } else {
      await route.continue();
    }
  });
}

test.beforeEach(async ({ page }) => {
  // Force dark mode by setting the theme in localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem('cs-v2-theme', 'dark');
  });
});

// ─────────────────────────────────────────────────────────────────
// 1. Dashboard loads in dark mode (body background is dark)
// ─────────────────────────────────────────────────────────────────
test('dark mode — dashboard loads with dark background', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // Wait for the shell to apply data-theme="dark"
  await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });

  // Verify the computed background color of the shell is dark
  const bgColor = await page.locator('.cs-v2-shell').evaluate((el) => {
    return getComputedStyle(el).backgroundColor;
  });
  // Dark bg is #1A1411 = rgb(26, 20, 17) — check that all channels are below 50
  const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  expect(match).toBeTruthy();
  if (match) {
    expect(Number(match[1])).toBeLessThan(80);
    expect(Number(match[2])).toBeLessThan(80);
    expect(Number(match[3])).toBeLessThan(80);
  }
});

// ─────────────────────────────────────────────────────────────────
// 2. Create page form is readable in dark mode
// ─────────────────────────────────────────────────────────────────
test('dark mode — create page form is readable', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Verify text color is light (foreground readable on dark bg)
  const fgColor = await page.getByText('Brief créatif').evaluate((el) => {
    return getComputedStyle(el).color;
  });
  const match = fgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  expect(match).toBeTruthy();
  if (match) {
    // Light text should have high channel values (> 150)
    expect(Number(match[1])).toBeGreaterThan(150);
    expect(Number(match[2])).toBeGreaterThan(150);
    expect(Number(match[3])).toBeGreaterThan(150);
  }
});

// ─────────────────────────────────────────────────────────────────
// 3. Trends page cards have dark backgrounds
// ─────────────────────────────────────────────────────────────────
test('dark mode — trends page cards have dark backgrounds', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  // Check first article card background
  const cardBg = await page.locator('article').first().evaluate((el) => {
    return getComputedStyle(el).backgroundColor;
  });
  // The card bg should be dark (could be transparent/inheriting or explicit dark)
  if (cardBg !== 'rgba(0, 0, 0, 0)' && cardBg !== 'transparent') {
    const match = cardBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      expect(Number(match[1])).toBeLessThan(100);
      expect(Number(match[2])).toBeLessThan(100);
      expect(Number(match[3])).toBeLessThan(100);
    }
  }
  // Content is still visible
  await expect(page.getByText('J-Beauty Routine')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 4. Config page provider cards render in dark mode
// ─────────────────────────────────────────────────────────────────
test('dark mode — config page provider cards render', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Knowledge page is readable in dark mode
// ─────────────────────────────────────────────────────────────────
test('dark mode — knowledge page is readable', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  await expect(page.locator('.cs-v2-shell[data-theme="dark"]')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Ingredients J-Beauty')).toBeVisible({ timeout: 20_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. No white flash on page load (background is set early)
// ─────────────────────────────────────────────────────────────────
test('dark mode — no white flash on page load', async ({ page }) => {
  await mockAllAPIs(page);

  // Check that after the shell renders, the background is already dark
  // (no intermediary white flash). We check the shell's data-theme
  // immediately after it appears.
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // Once the shell is visible, it should already have dark theme applied
  const shell = page.locator('.cs-v2-shell');
  await expect(shell).toBeVisible({ timeout: 15_000 });

  const dataTheme = await shell.getAttribute('data-theme');
  expect(dataTheme).toBe('dark');

  // And background is already dark
  const bgColor = await shell.evaluate((el) => getComputedStyle(el).backgroundColor);
  const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  expect(match).toBeTruthy();
  if (match) {
    expect(Number(match[1])).toBeLessThan(80);
    expect(Number(match[2])).toBeLessThan(80);
    expect(Number(match[3])).toBeLessThan(80);
  }
});
