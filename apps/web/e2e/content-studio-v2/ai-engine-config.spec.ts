/**
 * AI Engine — Configuration page E2E tests.
 *
 * Uses page.route() to mock the config APIs so tests are deterministic.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-1',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image', 'embedding'],
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
    {
      id: 'prov-2',
      providerType: 'anthropic',
      name: 'Anthropic',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      baseUrl: null,
      capabilities: ['text'],
      models: [{ name: 'claude-sonnet-4-20250514', capability: 'text', costPer1MInput: 300, costPer1MOutput: 1500 }],
      rateLimitRpm: null,
      dailyBudgetCents: null,
      circuitBreakerConfig: null,
      priority: 2,
      isFallback: true,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: null,
      configured: false,
    },
  ],
};

const MOCK_WORKFLOWS = {
  workflows: [
    {
      id: 'wf-1',
      name: 'Default Pipeline',
      description: 'Pipeline standard pour Instagram',
      platform: 'instagram',
      format: 'reel',
      graphConfig: { nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'] },
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
      name: 'FemiGlow Script Writer',
      systemPrompt: 'Tu es un expert en creation de contenu pour la marque FemiGlow, une marque de J-Beauty premium marocaine.',
      userPromptTemplate: 'Ecris un script pour {{platform}} au format {{format}}.',
      variables: ['platform', 'format', 'tone', 'keyMessage'],
      version: 1,
      isActive: true,
      parentId: null,
      avgQualityScore: '0.87',
      usageCount: 42,
      createdAt: new Date().toISOString(),
    },
  ],
};

/** Set up all config API mocks. */
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
  // Mock health endpoint used by "Tester la connexion"
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true }),
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. Page loads with title "Configuration"
// ─────────────────────────────────────────────────────────────────
test('config — page loads with title "Configuration"', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  // « AI Engine » apparaît plusieurs fois (sidebar, eyebrow…) : on cible l'eyebrow du header.
  await expect(page.locator('.cs-eyebrow', { hasText: 'AI Engine' })).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Configuration/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Fournisseurs tab is default
// ─────────────────────────────────────────────────────────────────
test('config — Fournisseurs tab is default', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Provider cards render with names
// ─────────────────────────────────────────────────────────────────
test('config — provider cards render with names', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Anthropic')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Capabilities badges display
// ─────────────────────────────────────────────────────────────────
test('config — capabilities badges display', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  // OpenAI has text, image, embedding capabilities
  // (le badge embedding est libellé « Embed » dans CAPABILITY_LABELS de config/page.tsx)
  await expect(page.getByText('Texte').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Image').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Embed').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Click "Workflows" tab switches content
// ─────────────────────────────────────────────────────────────────
test('config — click "Workflows" tab switches content', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Workflows' }).click();
  // L'onglet Workflows n'a plus de titre « Workflows de génération » :
  // il affiche le bouton « Créer un workflow » + la liste des cartes workflow.
  await expect(
    page.getByRole('button', { name: 'Créer un workflow' }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Default Pipeline')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Click "Prompts" tab shows templates
// ─────────────────────────────────────────────────────────────────
test('config — click "Prompts" tab shows templates', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Prompts' }).click();
  await expect(
    page.getByText(/Templates de prompts/i),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('FemiGlow Script Writer')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Click "Base de connaissances" tab switches
// ─────────────────────────────────────────────────────────────────
test('config — click "Base de connaissances" tab switches', async ({ page }) => {
  await mockConfigAPIs(page);
  // « Base de connaissances » n'est plus un onglet de la page Config :
  // c'est un lien du header qui navigue vers /ai-engine/knowledge.
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ collections: [] }) });
  });
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Base de connaissances' }).click();
  await expect(page).toHaveURL(/\/ai-engine\/knowledge/, { timeout: 15_000 });
  await expect(
    page.getByRole('heading', { name: /Base de connaissances/i }),
  ).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Back button navigates to dashboard
// ─────────────────────────────────────────────────────────────────
test('config — back button navigates to dashboard', async ({ page }) => {
  await mockConfigAPIs(page);
  await gotoAIEngine(page, 'config');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Fournisseurs IA')).toBeVisible({ timeout: 20_000 });

  // The back arrow link points to /ai-engine
  const backLink = page.locator('a[href*="/ai-engine"]').first();
  await expect(backLink).toBeVisible({ timeout: 10_000 });
  await backLink.click();
  await expect(page).toHaveURL(/\/ai-engine$/, { timeout: 15_000 });
});
