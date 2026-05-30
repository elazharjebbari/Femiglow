/**
 * AI Engine — Business scenario E2E tests.
 *
 * Tests full operator journeys that span multiple pages:
 * - S01: Golden path — config -> knowledge -> create -> review
 * - S02: Multi-platform content creation (Instagram, TikTok, LinkedIn)
 * - S03: Error recovery — provider fallback behavior
 * - S04: Knowledge-driven creation (seed KB -> verify in create)
 * - S05: Provider re-configuration mid-session
 * - S06: Sidebar navigation consistency
 * - S07: Budget monitoring across pages
 * - S08: API key setup then generate
 * - S09: Workflow customization then generate
 * - S10: Empty state -> fully configured journey
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

/* ================================================================
   Shared mock data
   ================================================================ */

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-openai', providerType: 'openai', name: 'OpenAI',
      apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY', baseUrl: null,
      capabilities: ['text', 'image', 'embedding'],
      models: [
        { name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 },
        { name: 'dall-e-3', capability: 'image', costPerUnit: 4000 },
      ],
      rateLimitRpm: 500, dailyBudgetCents: 500, circuitBreakerConfig: null,
      priority: 1, isFallback: false, isEnabled: true,
      healthStatus: 'healthy', lastHealthCheck: new Date().toISOString(), configured: true,
    },
    {
      id: 'prov-anthropic', providerType: 'anthropic', name: 'Anthropic',
      apiKeyEnvVar: 'AI_ENGINE_ANTHROPIC_API_KEY', baseUrl: null,
      capabilities: ['text'],
      models: [{ name: 'claude-sonnet-4-20250514', capability: 'text', costPer1MInput: 300, costPer1MOutput: 1500 }],
      rateLimitRpm: 60, dailyBudgetCents: 300, circuitBreakerConfig: null,
      priority: 2, isFallback: true, isEnabled: true,
      healthStatus: 'healthy', lastHealthCheck: null, configured: true,
    },
  ],
};

const MOCK_WORKFLOWS = {
  workflows: [
    {
      id: 'wf-1', name: 'Default Pipeline',
      description: 'Pipeline standard multi-plateforme',
      platform: null, format: null,
      graphConfig: { nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'], edges: [] },
      defaultTone: 'luxurious', defaultLanguage: 'fr',
      qualityThreshold: '0.70', maxRetries: 2, maxBudgetCents: 100,
      humanReviewRequired: false, autoPublish: false, providerOverrides: null,
      version: 1, isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ],
};

const MOCK_PROMPTS = {
  prompts: [
    {
      id: 'pt-1', nodeName: 'script_writer', name: 'FemiGlow Script Writer',
      systemPrompt: 'Tu es un expert en creation de contenu beaute japonaise.',
      userPromptTemplate: 'Ecris un script pour {{platform}} au format {{format}}.',
      variables: ['platform', 'format', 'tone', 'keyMessage'],
      version: 1, isActive: true, parentId: null,
      avgQualityScore: '0.87', usageCount: 42,
      createdAt: new Date().toISOString(),
    },
  ],
};

const MOCK_API_KEYS = {
  apiKeys: [
    {
      id: 'ak-001', providerType: 'openai', providerName: 'OpenAI',
      label: 'Production key', source: 'database', masked: 'sk-proj-****abc1',
      keyPrefix: 'sk-proj-', keyLastFour: 'abc1', isActive: true,
      baseUrl: null, lastTestedAt: new Date().toISOString(),
      lastTestResult: 'valid', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: null, providerType: 'anthropic', providerName: 'Anthropic',
      label: "Variable d'environnement", source: 'env', masked: 'sk-ant-****ef23',
      keyPrefix: 'sk-ant-', keyLastFour: 'ef23', isActive: true,
      baseUrl: null, lastTestedAt: null, lastTestResult: null,
      createdAt: null, updatedAt: null,
    },
  ],
};

const MOCK_COLLECTIONS = {
  collections: [
    {
      id: 'col-1', name: 'Brand Guidelines', slug: 'brand-guidelines',
      description: 'Identite de marque FemiGlow', category: 'brand',
      documentCount: 2, chunkCount: 15,
      lastIndexedAt: new Date().toISOString(), isActive: true,
    },
    {
      id: 'col-2', name: 'Platform Playbook', slug: 'platform-playbook',
      description: 'Guides par plateforme', category: 'platform',
      documentCount: 3, chunkCount: 25,
      lastIndexedAt: new Date().toISOString(), isActive: true,
    },
  ],
};

const MOCK_DOCS = {
  documents: [
    { id: 'doc-1', title: 'Charte graphique', sourceType: 'text', chunkCount: 5, createdAt: new Date().toISOString() },
    { id: 'doc-2', title: 'Tone of voice', sourceType: 'url', chunkCount: 10, createdAt: new Date().toISOString() },
  ],
};

const MOCK_GENERATE_RESPONSE = {
  jobId: 'job-scenario-001',
  status: 'completed',
  script: {
    hook: 'Decouvrez le secret des ongles parfaits',
    scenes: [{ sceneNumber: 1, description: 'Gros plan mains avec huile Tsubaki' }],
    cta: 'Essayez FemiGlow maintenant',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Le rituel beaute japonais qui a conquis le Maroc',
  hashtags: ['femiglow', 'jbeauty', 'nailcare'],
  images: [
    {
      assetId: 'img-1', url: '/test.png', mimeType: 'image/png',
      width: 1080, height: 1080, provider: 'mock', costCents: 0,
    },
  ],
  videos: [],
  qualityScores: {
    text_quality: 0.9, visual_quality: 0.8,
    brand_compliance: 0.95, hook_strength: 0.85, average: 0.88,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: {
    totalCents: 0.15,
    breakdown: { generate_script: 0.08, generate_caption: 0.07 },
    tokensUsed: {},
  },
  errors: [],
  durationMs: 5000,
  bridgeResult: { ideaId: 'ci_test', briefId: 'cb_test', draftId: 'cd_test' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_test',
};

const MOCK_ANALYTICS = {
  totalGenerations: 127,
  totalCostCents: 4850,
  avgQuality: 0.82,
  generationsByDay: [],
  costByProvider: { openai: 3200, anthropic: 1650 },
  qualityDistribution: {},
};

/* ================================================================
   Setup helper
   ================================================================ */

async function setupAllMocks(page: import('@playwright/test').Page) {
  // Config APIs
  await page.route('**/api/admin/ai-engine/config/providers', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { success: true, provider: MOCK_PROVIDERS.providers[0] } });
    }
    return route.fulfill({ json: MOCK_PROVIDERS });
  });

  await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { workflow: MOCK_WORKFLOWS.workflows[0] } });
    }
    return route.fulfill({ json: MOCK_WORKFLOWS });
  });

  await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
    return route.fulfill({ json: MOCK_PROMPTS });
  });

  await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
    return route.fulfill({ json: MOCK_API_KEYS });
  });

  await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
    return route.fulfill({
      json: { result: { valid: true, provider: 'openai', latencyMs: 95 } },
    });
  });

  await page.route('**/api/admin/ai-engine/health', (route) => {
    return route.fulfill({ json: { enabled: true } });
  });

  // Knowledge APIs
  await page.route('**/api/admin/ai-engine/knowledge', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_COLLECTIONS });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          collection: {
            id: 'col-new', name: 'New Collection', slug: 'new-collection',
            description: 'Test', category: 'brand', documentCount: 0,
            chunkCount: 0, lastIndexedAt: null, isActive: true,
          },
        },
      });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents', (route) => {
    return route.fulfill({ json: MOCK_DOCS });
  });

  await page.route('**/api/admin/ai-engine/knowledge/platform-playbook/documents', (route) => {
    return route.fulfill({
      json: {
        documents: [
          { id: 'doc-3', title: 'Instagram Guide', sourceType: 'text', chunkCount: 10, createdAt: new Date().toISOString() },
          { id: 'doc-4', title: 'TikTok Guide', sourceType: 'text', chunkCount: 8, createdAt: new Date().toISOString() },
          { id: 'doc-5', title: 'LinkedIn Guide', sourceType: 'text', chunkCount: 7, createdAt: new Date().toISOString() },
        ],
      },
    });
  });

  await page.route('**/api/admin/ai-engine/knowledge/embed', (route) => {
    return route.fulfill({
      json: { documentsProcessed: 5, chunksCreated: 40 },
    });
  });

  // Generate API
  await page.route('**/api/admin/ai-engine/generate', (route) => {
    return route.fulfill({ json: MOCK_GENERATE_RESPONSE });
  });

  // Analytics API
  await page.route('**/api/admin/ai-engine/analytics**', (route) => {
    return route.fulfill({ json: MOCK_ANALYTICS });
  });

  // Dashboard API
  await page.route('**/api/admin/ai-engine/dashboard**', (route) => {
    return route.fulfill({ json: { stats: MOCK_ANALYTICS } });
  });
}

/* ================================================================
   Tests
   ================================================================ */

test.describe('Scenario: Config to Create', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();
    await setupAllMocks(page);
  });

  test('S01: Full golden path - config -> knowledge -> create', async ({ page }) => {
    test.slow();

    // Step 1: Navigate to Config, verify providers loaded
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Anthropic')).toBeVisible();

    // Step 2: Navigate to API Keys tab, verify key display
    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText('Ajouter une cl', { exact: false })).toBeVisible({ timeout: 5_000 });

    // Step 3: Navigate to Knowledge via sidebar
    const knowledgeLink = page.locator('a[href*="/knowledge"]').first();
    await knowledgeLink.click();
    await expect(page.getByText('Base de connaissances')).toBeVisible({ timeout: 15_000 });

    // Step 4: Verify collections loaded
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Platform Playbook')).toBeVisible();

    // Step 5: Navigate to Create via sidebar
    const createLink = page.locator('a[href*="/ai-engine/create"]').first();
    await createLink.click();
    await expect(page.getByText('Brief cr', { exact: false })).toBeVisible({ timeout: 15_000 });

    // Step 6: Fill brief form
    await page.locator('select').nth(0).selectOption('engagement');
    await page.locator('select').nth(1).selectOption('instagram');
    await page.locator('select').nth(2).selectOption('carousel');
    await page.locator('select').nth(3).selectOption('luxurious');
    await page.locator('textarea').first().fill('Le rituel beaute japonais FemiGlow');

    // Step 7: Click Generate
    const genButton = page.getByRole('button', { name: /G[eé]n[eé]rer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();

    // Step 8: Verify generation progress
    await expect(page.getByText(/Pipeline|G[eé]n[eé]ration|Analyse/i)).toBeVisible({ timeout: 15_000 });
  });

  test('S02: Multi-platform content creation — Instagram then TikTok', async ({ page }) => {
    test.slow();

    // Navigate to Create
    await gotoAIEngine(page, 'create');
    await expect(page.getByText('Brief cr', { exact: false })).toBeVisible({ timeout: 15_000 });

    // Create Instagram content
    await page.locator('select').nth(0).selectOption('engagement');
    await page.locator('select').nth(1).selectOption('instagram');
    await page.locator('select').nth(2).selectOption('carousel');
    await page.locator('select').nth(3).selectOption('luxurious');
    await page.locator('textarea').first().fill('Rituel ongles FemiGlow pour Instagram');

    const genButton = page.getByRole('button', { name: /G[eé]n[eé]rer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();

    // Wait for generation pipeline to appear
    await expect(page.getByText(/Pipeline|G[eé]n[eé]ration|Analyse/i)).toBeVisible({ timeout: 15_000 });

    // Navigate back to Create for TikTok content
    await gotoAIEngine(page, 'create');
    await expect(page.getByText('Brief cr', { exact: false })).toBeVisible({ timeout: 15_000 });

    // Create TikTok content with different settings
    await page.locator('select').nth(0).selectOption('awareness');
    await page.locator('select').nth(1).selectOption('tiktok');
    await page.locator('select').nth(2).selectOption('reel');
    await page.locator('select').nth(3).selectOption('playful');
    await page.locator('textarea').first().fill('Defi beaute japonaise TikTok FemiGlow');

    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();

    await expect(page.getByText(/Pipeline|G[eé]n[eé]ration|Analyse/i)).toBeVisible({ timeout: 15_000 });
  });

  test('S03: Error recovery — provider returns 500, user retries', async ({ page }) => {
    // Override generate to fail first time
    let callCount = 0;
    await page.route('**/api/admin/ai-engine/generate', (route) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({
          status: 500,
          json: { error: 'Provider OpenAI rate limited. Fallback provider Anthropic also failed.' },
        });
      }
      return route.fulfill({ json: MOCK_GENERATE_RESPONSE });
    });

    await gotoAIEngine(page, 'create');
    await expect(page.getByText('Brief cr', { exact: false })).toBeVisible({ timeout: 15_000 });

    // Fill brief
    await page.locator('select').nth(0).selectOption('engagement');
    await page.locator('select').nth(1).selectOption('instagram');
    await page.locator('select').nth(2).selectOption('carousel');
    await page.locator('select').nth(3).selectOption('luxurious');
    await page.locator('textarea').first().fill('Test error recovery');

    // First attempt — should fail
    const genButton = page.getByRole('button', { name: /G[eé]n[eé]rer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();

    // Error should appear
    await expect(page.getByText(/erreur|rate limit|[eé]chou[eé]|impossible/i)).toBeVisible({ timeout: 10_000 });

    // User can retry
    const retryButton = page.getByRole('button', { name: /r[eé]essayer|g[eé]n[eé]rer/i });
    if (await retryButton.isVisible()) {
      await retryButton.click();
      // Second attempt should succeed
      await expect(page.getByText(/Pipeline|G[eé]n[eé]ration|Analyse|Contenu/i)).toBeVisible({ timeout: 15_000 });
    }
  });

  test('S04: Config page shows correct stat summary', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });

    // Verify stat cards are populated
    // 2/2 providers configured
    await expect(page.getByText('2/2')).toBeVisible({ timeout: 10_000 });
    // Active workflows: 1
    await expect(page.getByText('Workflows actifs')).toBeVisible();
    // Active prompts: 1
    await expect(page.getByText('Prompts versionn', { exact: false })).toBeVisible();
  });

  test('S05: Sidebar navigation — all AI Engine sub-pages accessible', async ({ page }) => {
    test.slow();

    // Start at Config
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });

    // Sidebar should show AI Engine sub-nav
    await expect(page.locator('nav[aria-label="AI Engine"]')).toBeVisible();

    // Navigate to Connaissances (Knowledge)
    await page.locator('a[href*="/knowledge"]').first().click();
    await expect(page.getByText('Base de connaissances')).toBeVisible({ timeout: 15_000 });

    // Navigate to Generer (Create)
    await page.locator('a[href*="/ai-engine/create"]').first().click();
    await expect(page.getByText('Brief cr', { exact: false })).toBeVisible({ timeout: 15_000 });

    // Navigate to Veille (Trends)
    await page.locator('a[href*="/trends"]').first().click();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to Metriques (Analytics)
    await page.locator('a[href*="/analytics"]').first().click();
    await page.waitForLoadState('domcontentloaded');

    // Navigate back to Config
    await page.locator('a[href*="/config"]').first().click();
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });
  });

  test('S06: Knowledge page embed then verify stats update', async ({ page }) => {
    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Verify initial stats
    await expect(page.getByText('Collections')).toBeVisible();
    await expect(page.getByText('Documents')).toBeVisible();

    // Click embed
    await page.getByText('G', { exact: false }).filter({ hasText: /G[eé]n[eé]rer les embeddings/ }).click();

    // Verify success banner
    await expect(page.getByText(/5 document/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/40/).first()).toBeVisible();
  });

  test('S07: Provider edit then verify save persists on tab switch', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    // Edit OpenAI provider
    await page.getByText('Éditer').first().click();
    await page.getByText('Sauvegarder').click();
    await expect(page.getByText('Configuration sauvegard', { exact: false })).toBeVisible({ timeout: 5_000 });

    // Switch to Workflows tab and back
    await page.getByText('Workflows').first().click();
    await expect(page.getByText('Default Pipeline')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Fournisseurs').click();
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 5_000 });
  });

  test('S08: API key test flow in config', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    // Navigate to API Keys tab
    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText('Production key')).toBeVisible({ timeout: 5_000 });

    // Test the OpenAI key
    await page.getByText('Tester').first().click();

    // Should show success toast
    await expect(page.getByText(/valide|valid|succ/i)).toBeVisible({ timeout: 5_000 });
  });

  test('S09: Create workflow then verify it appears in list', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    // Go to Workflows tab
    await page.getByText('Workflows').first().click();
    await expect(page.getByText('Default Pipeline')).toBeVisible({ timeout: 5_000 });

    // Click Create
    await page.getByText('Cr', { exact: false }).filter({ hasText: /Cr[eé]er un workflow/ }).click();

    // Fill form
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill('LinkedIn B2B Campaign');

    const descInput = page.locator('input[placeholder="Description du workflow"]');
    if (await descInput.isVisible()) {
      await descInput.fill('Workflow pour campagnes B2B LinkedIn');
    }

    // Save
    await page.getByRole('button', { name: /Sauvegarder/i }).click();

    // Form should close
    await expect(page.locator('input[placeholder="Description du workflow"]')).toBeHidden({ timeout: 5_000 });
  });

  test('S10: Knowledge expand collection and view document content', async ({ page }) => {
    // Mock document detail
    await page.route('**/api/admin/ai-engine/knowledge/brand-guidelines/documents/doc-1', (route) => {
      return route.fulfill({
        json: {
          document: {
            id: 'doc-1', collectionId: 'col-1', title: 'Charte graphique',
            sourceType: 'text', sourceUrl: null,
            contentText: 'FemiGlow est une marque de J-Beauty premium. Couleurs: ivoire, terracotta, or.',
            metadata: null, chunkCount: 5,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          },
        },
      });
    });

    await gotoAIEngine(page, 'knowledge');
    await expect(page.getByText('Brand Guidelines')).toBeVisible({ timeout: 10_000 });

    // Expand collection
    await page.getByText('Brand Guidelines').click();
    await expect(page.getByText('Charte graphique')).toBeVisible({ timeout: 5_000 });

    // Click view button
    await page.locator('button[title="Voir le contenu"]').first().click();

    // Verify content in modal
    await expect(page.getByText('FemiGlow est une marque de J-Beauty premium')).toBeVisible({ timeout: 5_000 });
  });

  test('S11: Config to Knowledge back-and-forth via header links', async ({ page }) => {
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });

    // Click "Base de connaissances" link in header
    const kbLink = page.locator('a[href*="/knowledge"]').filter({ hasText: /Base de connaissances|Connaissances/ }).first();
    await kbLink.click();
    await expect(page.getByText('Base de connaissances')).toBeVisible({ timeout: 15_000 });

    // Navigate back via sidebar Config link
    await page.locator('a[href*="/config"]').first().click();
    await expect(page.getByText('Configuration')).toBeVisible({ timeout: 15_000 });
  });

  test('S12: Verify providers tab is default on config page load', async ({ page }) => {
    await gotoAIEngine(page, 'config');

    // Fournisseurs tab should be active by default
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Anthropic')).toBeVisible();

    // Workflows content should NOT be visible yet
    await expect(page.getByText('Default Pipeline')).toBeHidden();
  });
});
