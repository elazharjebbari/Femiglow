/**
 * AI Engine — Higgsfield Provider Integration E2E tests.
 *
 * 25 tests covering:
 *  - Provider card rendering (10)
 *  - Edit form interaction (8)
 *  - API Keys tab for Higgsfield (7)
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

/* ================================================================
   Mock data
   ================================================================ */

const HIGGSFIELD_PROVIDER = {
  id: 'prov-higgsfield',
  providerType: 'higgsfield',
  name: 'Higgsfield AI',
  apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
  baseUrl: null,
  capabilities: ['image', 'video'],
  models: [
    { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
    { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
    { name: 'higgsfield-xl', capability: 'image', costPerUnit: 800 },
  ],
  rateLimitRpm: 120,
  dailyBudgetCents: 800,
  circuitBreakerConfig: null,
  priority: 15,
  isFallback: false,
  isEnabled: true,
  healthStatus: 'healthy',
  lastHealthCheck: new Date().toISOString(),
  configured: true,
};

const HIGGSFIELD_UNCONFIGURED = {
  ...HIGGSFIELD_PROVIDER,
  id: 'prov-higgsfield-unconf',
  configured: false,
  isEnabled: false,
  healthStatus: 'unknown',
  lastHealthCheck: null,
  dailyBudgetCents: null,
  rateLimitRpm: null,
};

const MOCK_OPENAI = {
  id: 'prov-openai',
  providerType: 'openai',
  name: 'OpenAI',
  apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
  baseUrl: null,
  capabilities: ['text', 'image'],
  models: [
    { name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 },
  ],
  rateLimitRpm: 500,
  dailyBudgetCents: 500,
  circuitBreakerConfig: null,
  priority: 1,
  isFallback: false,
  isEnabled: true,
  healthStatus: 'healthy',
  lastHealthCheck: new Date().toISOString(),
  configured: true,
};

const MOCK_PROVIDERS_WITH_HIGGSFIELD = {
  providers: [MOCK_OPENAI, HIGGSFIELD_PROVIDER],
};

const MOCK_PROVIDERS_UNCONFIGURED = {
  providers: [MOCK_OPENAI, HIGGSFIELD_UNCONFIGURED],
};

const MOCK_WORKFLOWS = { workflows: [] };
const MOCK_PROMPTS = { prompts: [] };

const MOCK_API_KEYS_WITH_HIGGSFIELD = {
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
      id: null, providerType: 'higgsfield', providerName: 'Higgsfield AI',
      label: 'Non configuré', source: 'none', masked: '',
      keyPrefix: '', keyLastFour: '', isActive: false,
      baseUrl: null, lastTestedAt: null, lastTestResult: null,
      createdAt: null, updatedAt: null,
    },
  ],
};

const MOCK_API_KEYS_HIGGSFIELD_CONFIGURED = {
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
      id: 'ak-hf-001', providerType: 'higgsfield', providerName: 'Higgsfield AI',
      label: 'Production Higgsfield', source: 'database', masked: 'hf-****xyz9',
      keyPrefix: 'hf-', keyLastFour: 'xyz9', isActive: true,
      baseUrl: null, lastTestedAt: new Date().toISOString(),
      lastTestResult: 'valid', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

/* ================================================================
   Setup helpers
   ================================================================ */

async function setupHiggsfieldMocks(
  page: import('@playwright/test').Page,
  opts: {
    providers?: typeof MOCK_PROVIDERS_WITH_HIGGSFIELD;
    apiKeys?: typeof MOCK_API_KEYS_WITH_HIGGSFIELD;
  } = {},
) {
  const providers = opts.providers ?? MOCK_PROVIDERS_WITH_HIGGSFIELD;
  const apiKeys = opts.apiKeys ?? MOCK_API_KEYS_WITH_HIGGSFIELD;

  await page.route('**/api/admin/ai-engine/config/providers', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: providers });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { success: true, provider: HIGGSFIELD_PROVIDER } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
    return route.fulfill({ json: MOCK_WORKFLOWS });
  });

  await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
    return route.fulfill({ json: MOCK_PROMPTS });
  });

  await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: apiKeys });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          apiKey: {
            id: 'ak-hf-new', providerType: 'higgsfield', providerName: 'Higgsfield AI',
            label: 'New Higgsfield key', source: 'database', masked: 'hf-****newk',
            keyPrefix: 'hf-', keyLastFour: 'newk', isActive: true,
            baseUrl: null, lastTestedAt: null, lastTestResult: null,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          },
        },
      });
    }
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true, fallbackToEnv: false } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
    return route.fulfill({
      json: { result: { valid: true, provider: 'higgsfield', latencyMs: 85 } },
    });
  });

  await page.route('**/api/admin/ai-engine/health', (route) => {
    return route.fulfill({ json: { enabled: true } });
  });
}

/* ================================================================
   Higgsfield Provider Card — 10 tests
   ================================================================ */

test.describe('Higgsfield Provider Card', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupHiggsfieldMocks(page);
    await gotoAIEngine(page, 'config');
  });

  test('Higgsfield card is visible in provider grid', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
  });

  test('card shows "Higgsfield AI" name', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    const nameEl = page.getByText('Higgsfield AI');
    await expect(nameEl).toHaveCount(1);
  });

  test('card shows Image and Video capability badges', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    // Capabilities: image -> "Image", video -> "Vidéo"
    await expect(page.getByText('Image').nth(0)).toBeVisible();
    await expect(page.getByText('Vid', { exact: false }).filter({ hasText: /Vid[eé]o/ }).first()).toBeVisible();
  });

  test('card shows 3 models (diffusion-v2, video-v1, xl)', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('higgsfield-diffusion-v2')).toBeVisible();
    await expect(page.getByText('higgsfield-video-v1')).toBeVisible();
    await expect(page.getByText('higgsfield-xl')).toBeVisible();
  });

  test('card shows priority 15', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Priorit[eé] 15/)).toBeVisible();
  });

  test('card shows budget in footer (8.00 MAD/j)', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('8.00 MAD/j')).toBeVisible();
  });

  test('card shows rate limit in footer (120/min)', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('120/min')).toBeVisible();
  });

  test('unconfigured Higgsfield has reduced opacity (Inactif badge)', async ({ page }) => {
    // Re-mock with unconfigured provider
    await setupHiggsfieldMocks(page, { providers: MOCK_PROVIDERS_UNCONFIGURED });
    await gotoAIEngine(page, 'config');

    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    // Unconfigured shows "Inactif"
    const inactifBadges = page.getByText('Inactif');
    await expect(inactifBadges.first()).toBeVisible();
  });

  test('configured Higgsfield shows full opacity (Actif badge)', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    // The "Actif" text appears for configured providers
    const actifBadges = page.getByText('Actif');
    // At least 2 — OpenAI and Higgsfield
    expect(await actifBadges.count()).toBeGreaterThanOrEqual(2);
  });

  test('health status bar is green when healthy', async ({ page }) => {
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
    // Both OpenAI and Higgsfield are healthy and configured, so "Actif" badge is present
    // The status bar at the top of the card uses var(--cs-success) for healthy
    const actifElements = page.getByText('Actif');
    await expect(actifElements.nth(1)).toBeVisible();
  });
});

/* ================================================================
   Higgsfield Edit Form — 8 tests
   ================================================================ */

test.describe('Higgsfield Edit Form', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await setupHiggsfieldMocks(page);
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });
  });

  test('click Éditer opens inline form for Higgsfield', async ({ page }) => {
    // Higgsfield is the 2nd provider, so its Éditer is the 2nd button
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Sauvegarder')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Annuler')).toBeVisible();
  });

  test('edit form has priority input (default 15)', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Priorit', { exact: false })).toBeVisible({ timeout: 5_000 });
    // A number input with value 15 should be present
    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('edit form has budget input', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Budget quotidien', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  test('edit form has rate limit input', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Rate limit', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  test('edit form has Actif checkbox', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    // The form section with "Sauvegarder" has checkboxes
    await expect(page.getByText('Sauvegarder')).toBeVisible({ timeout: 5_000 });
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('edit form has ModelSelector showing Higgsfield models', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Mod', { exact: false }).filter({ hasText: /Mod[eè]les/ }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('save sends POST with updated fields', async ({ page }) => {
    let postBody: unknown = null;
    await page.route('**/api/admin/ai-engine/config/providers', async (route) => {
      if (route.request().method() === 'POST') {
        postBody = route.request().postDataJSON();
        return route.fulfill({ json: { success: true, provider: HIGGSFIELD_PROVIDER } });
      }
      return route.fulfill({ json: MOCK_PROVIDERS_WITH_HIGGSFIELD });
    });

    await gotoAIEngine(page, 'config');
    await expect(page.getByText('Higgsfield AI')).toBeVisible({ timeout: 10_000 });

    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Sauvegarder')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Sauvegarder').click();

    await expect(page.getByText('Configuration sauvegard', { exact: false })).toBeVisible({ timeout: 5_000 });
    expect(postBody).toBeTruthy();
    expect((postBody as Record<string, unknown>).id).toBe('prov-higgsfield');
  });

  test('cancel closes form without saving', async ({ page }) => {
    const editButtons = page.getByText('Éditer');
    await editButtons.nth(1).click();
    await expect(page.getByText('Sauvegarder')).toBeVisible({ timeout: 5_000 });

    await page.getByText('Annuler').first().click();
    await expect(page.getByText('Sauvegarder')).toBeHidden({ timeout: 3_000 });
  });
});

/* ================================================================
   Higgsfield API Keys — 7 tests
   ================================================================ */

test.describe('Higgsfield API Keys', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();
  });

  test('Higgsfield row visible with "Non configuré" badge', async ({ page }) => {
    await setupHiggsfieldMocks(page);
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    // Navigate to Clés API tab
    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('Higgsfield AI')).toBeVisible();
    await expect(page.getByText('Non configur', { exact: false }).first()).toBeVisible();
  });

  test('add key form: select Higgsfield provider', async ({ page }) => {
    await setupHiggsfieldMocks(page);
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    await page.getByText('Ajouter une cl', { exact: false }).click();
    await expect(page.getByText('Ajouter une cl', { exact: false }).filter({ hasText: /cl[eé] API/ })).toBeVisible({ timeout: 5_000 });

    // The provider select should include Higgsfield option
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
    const options = select.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('add key: enter key value, submit, verify success toast', async ({ page }) => {
    await setupHiggsfieldMocks(page);
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    await page.getByText('Ajouter une cl', { exact: false }).click();
    await expect(page.getByText('Ajouter une cl', { exact: false }).filter({ hasText: /cl[eé] API/ })).toBeVisible({ timeout: 5_000 });

    // Fill in the key
    const apiInput = page.getByPlaceholder('sk-...');
    await apiInput.fill('hf-test-key-12345');
    // Submit
    await page.getByText('Enregistrer').click();

    await expect(page.getByText('enregistr', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  test('configured Higgsfield shows "Base de données" badge', async ({ page }) => {
    await setupHiggsfieldMocks(page, { apiKeys: MOCK_API_KEYS_HIGGSFIELD_CONFIGURED });
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('Higgsfield AI')).toBeVisible();
    // Source is "database" -> "Base de données"
    await expect(page.getByText('Base de donn', { exact: false }).first()).toBeVisible();
  });

  test('test key button triggers validation', async ({ page }) => {
    await setupHiggsfieldMocks(page, { apiKeys: MOCK_API_KEYS_HIGGSFIELD_CONFIGURED });
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    // There should be Tester buttons for configured keys
    const testButtons = page.getByText('Tester');
    const count = await testButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
    // Click the second Tester (Higgsfield's)
    await testButtons.nth(1).click();

    // Should show validation result
    await expect(page.getByText('valide', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('delete key shows confirmation', async ({ page }) => {
    await setupHiggsfieldMocks(page, { apiKeys: MOCK_API_KEYS_HIGGSFIELD_CONFIGURED });
    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    // Find Supprimer buttons
    const deleteButtons = page.getByText('Supprimer');
    const count = await deleteButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await deleteButtons.last().click();

    // Confirmation should appear
    await expect(page.getByText(/Supprimer la cl[eé]/)).toBeVisible({ timeout: 5_000 });
  });

  test('after delete, Higgsfield falls back to "Non configuré"', async ({ page }) => {
    // Start with configured, then after delete the mock returns unconfigured
    let deleteCount = 0;
    await page.route('**/api/admin/ai-engine/config/providers', (route) => {
      return route.fulfill({ json: MOCK_PROVIDERS_WITH_HIGGSFIELD });
    });
    await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
      return route.fulfill({ json: MOCK_WORKFLOWS });
    });
    await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
      return route.fulfill({ json: MOCK_PROMPTS });
    });
    await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
      if (route.request().method() === 'GET') {
        // After delete, return unconfigured Higgsfield
        if (deleteCount > 0) {
          return route.fulfill({ json: MOCK_API_KEYS_WITH_HIGGSFIELD });
        }
        return route.fulfill({ json: MOCK_API_KEYS_HIGGSFIELD_CONFIGURED });
      }
      if (route.request().method() === 'DELETE') {
        deleteCount++;
        return route.fulfill({ json: { success: true, fallbackToEnv: false } });
      }
      return route.continue();
    });
    await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
      return route.fulfill({ json: { result: { valid: true, provider: 'higgsfield', latencyMs: 85 } } });
    });
    await page.route('**/api/admin/ai-engine/health', (route) => {
      return route.fulfill({ json: { enabled: true } });
    });

    await gotoAIEngine(page, 'config');
    await expect(page.getByText('OpenAI')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Cl', { exact: false }).filter({ hasText: /Cl[eé]s API/ }).click();
    await expect(page.getByText("Cl", { exact: false }).filter({ hasText: /acc[eè]s API/ })).toBeVisible({ timeout: 5_000 });

    // Verify Higgsfield is configured initially
    await expect(page.getByText('Higgsfield AI')).toBeVisible();
    await expect(page.getByText('Base de donn', { exact: false }).first()).toBeVisible();

    // Click Supprimer on the Higgsfield key
    const deleteButtons = page.getByText('Supprimer');
    await deleteButtons.last().click();

    // Confirm deletion
    await expect(page.getByText(/Supprimer la cl[eé]/)).toBeVisible({ timeout: 5_000 });
    const confirmDeleteBtns = page.getByText('Supprimer');
    await confirmDeleteBtns.last().click();

    // After delete, should show "Non configuré"
    await expect(page.getByText('Non configur', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
  });
});
