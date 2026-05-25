/**
 * AI Engine — Page refresh behavior E2E tests.
 *
 * Verifies that refreshing (page.reload()) on different AI Engine pages
 * restores state correctly: data reloads from mocked APIs, and ephemeral
 * form state is reset as expected.
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
      capabilities: ['text'],
      models: [{ name: 'gpt-4o', capability: 'text' }],
      configured: true,
      isEnabled: true,
      healthStatus: 'healthy',
      priority: 1,
      isFallback: false,
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: null,
      rateLimitRpm: 60,
      dailyBudgetCents: 500,
      circuitBreakerConfig: null,
      lastHealthCheck: new Date().toISOString(),
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

const MOCK_GENERATE_RESPONSE = {
  jobId: 'test-job-123',
  status: 'completed',
  script: {
    hook: 'Test hook',
    scenes: [{ sceneNumber: 1, description: 'Test scene' }],
    cta: 'Test CTA',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Test caption for FemiGlow',
  hashtags: ['femiglow', 'jbeauty'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.9, average: 0.88 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.15, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 5000,
  bridgeResult: { ideaId: 'ci_test', briefId: 'cb_test', draftId: 'cd_test' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_test',
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
}

// ─────────────────────────────────────────────────────────────────
// 1. Refresh on dashboard reloads health data correctly
// ─────────────────────────────────────────────────────────────────
test('refresh — dashboard reloads health data correctly', async ({ page }) => {
  let healthCallCount = 0;
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    healthCallCount++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HEALTH) });
  });

  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });

  const callsBefore = healthCallCount;
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('AI Engine')).toBeVisible({ timeout: 15_000 });

  // The health API should have been called again after reload
  expect(healthCallCount).toBeGreaterThan(callsBefore);
});

// ─────────────────────────────────────────────────────────────────
// 2. Refresh on create page with empty form shows empty form
// ─────────────────────────────────────────────────────────────────
test('refresh — create page with empty form shows empty form', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Verify the generate button is disabled (form is empty/reset)
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeVisible();
  await expect(genButton).toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────
// 3. Refresh on trends page reloads trends data
// ─────────────────────────────────────────────────────────────────
test('refresh — trends page reloads trends data', async ({ page }) => {
  let trendsCallCount = 0;
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    trendsCallCount++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TRENDS) });
  });

  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  const callsBefore = trendsCallCount;
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'J-Beauty Routine' })).toBeVisible({ timeout: 20_000 });

  expect(trendsCallCount).toBeGreaterThan(callsBefore);
});

// ─────────────────────────────────────────────────────────────────
// 4. Refresh on config page reloads provider data
// ─────────────────────────────────────────────────────────────────
test('refresh — config page reloads provider data', async ({ page }) => {
  let providerCallCount = 0;
  await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
    providerCallCount++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROVIDERS) });
  });
  await page.route('**/api/admin/ai-engine/config/workflows', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WORKFLOWS) });
  });
  await page.route('**/api/admin/ai-engine/config/prompts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROMPTS) });
  });
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HEALTH) });
  });

  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  const callsBefore = providerCallCount;
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  expect(providerCallCount).toBeGreaterThan(callsBefore);
});

// ─────────────────────────────────────────────────────────────────
// 5. Navigate to create, fill form partially, refresh -> form is reset
// ─────────────────────────────────────────────────────────────────
test('refresh — partially filled form is reset after refresh', async ({ page }) => {
  await mockAllAPIs(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Fill some fields
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('textarea').first().fill('Le rituel FemiGlow');

  // Verify fields are filled
  await expect(page.locator('textarea').first()).toHaveValue('Le rituel FemiGlow');

  // Refresh
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Form should be reset — textarea should be empty
  await expect(page.locator('textarea').first()).toHaveValue('');

  // Generate button should be disabled again
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────
// 6. After generation result, refresh -> goes back to brief form
// ─────────────────────────────────────────────────────────────────
test('refresh — after generation result, refresh goes back to brief form', async ({ page }) => {
  await mockAllAPIs(page);
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Fill brief and generate
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Le rituel FemiGlow');

  await page.getByRole('button', { name: /Générer/i }).click();
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Refresh — state is lost (expected behavior)
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  // Should go back to the brief form, not the result
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeVisible();
});
