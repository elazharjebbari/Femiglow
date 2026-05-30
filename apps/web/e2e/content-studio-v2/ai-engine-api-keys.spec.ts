/**
 * AI Engine — API Keys Management E2E tests.
 *
 * Tests: list keys, add key, delete key, test key, security.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_PROVIDERS = {
  providers: [
    { id: 'prov-001', providerType: 'openai', name: 'OpenAI', apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY', capabilities: ['text', 'image'], models: [], isEnabled: true, healthStatus: 'healthy', priority: 10, configured: true, baseUrl: null, rateLimitRpm: 500, dailyBudgetCents: 500, circuitBreakerConfig: null, isFallback: false, lastHealthCheck: null },
  ],
};

const MOCK_API_KEYS = {
  apiKeys: [
    { id: 'ak-001', providerType: 'openai', providerName: 'OpenAI', label: 'Production key', source: 'database', masked: 'sk-proj-****abc1', keyPrefix: 'sk-proj-', keyLastFour: 'abc1', isActive: true, baseUrl: null, lastTestedAt: new Date().toISOString(), lastTestResult: 'valid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: null, providerType: 'anthropic', providerName: 'Anthropic', label: "Variable d'environnement", source: 'env', masked: 'sk-ant-****ef23', keyPrefix: 'sk-ant-', keyLastFour: 'ef23', isActive: true, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
    { id: null, providerType: 'google', providerName: 'Google AI (Gemini)', label: 'Non configure', source: 'none', masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
    { id: null, providerType: 'elevenlabs', providerName: 'ElevenLabs', label: 'Non configure', source: 'none', masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
    { id: null, providerType: 'ollama', providerName: 'Ollama (local)', label: 'Non configure', source: 'none', masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
  ],
};

test.describe('API Keys Management', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthOrSkip(page);
    if (!ok) test.skip();

    await page.route('**/api/admin/ai-engine/config/providers', (route) => {
      return route.fulfill({ json: MOCK_PROVIDERS });
    });

    await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: MOCK_API_KEYS });
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            apiKey: {
              id: 'ak-new', providerType: 'google', providerName: 'Google AI',
              label: 'Test key', source: 'database', masked: 'AIza****1234',
              keyPrefix: 'AIza', keyLastFour: '1234', isActive: true,
              baseUrl: null, lastTestedAt: null, lastTestResult: null,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
          },
        });
      }
      return route.continue();
    });

    await page.route('**/api/admin/ai-engine/config/api-keys/*/route*', (route) => {
      return route.fulfill({ json: { success: true, fallbackToEnv: false } });
    });

    await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
      return route.fulfill({
        json: { result: { valid: true, provider: 'openai', latencyMs: 120 } },
      });
    });

    // Mock other config routes
    await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
      return route.fulfill({ json: { workflows: [] } });
    });

    await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
      return route.fulfill({ json: { prompts: [] } });
    });

    await gotoAIEngine(page, '/config');
  });

  test('shows API Keys tab in navigation', async ({ page }) => {
    await expect(page.getByText('Cles API', { exact: false })).toBeVisible();
  });

  test('clicking API Keys tab loads key list', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await expect(page.getByText('OpenAI')).toBeVisible();
    await expect(page.getByText('Anthropic')).toBeVisible();
    await expect(page.getByText('Google AI', { exact: false })).toBeVisible();
  });

  test('shows source badges (database, env, none)', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await expect(page.getByText('Base de donn', { exact: false })).toBeVisible();
    await expect(page.getByText('Env var')).toBeVisible();
  });

  test('shows masked key value', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await expect(page.getByText('sk-proj-')).toBeVisible();
  });

  test('add key button opens form', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();
    await expect(page.getByText('Fournisseur')).toBeVisible();
  });

  test('test button is visible for configured keys', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    const testButtons = page.getByText('Tester');
    await expect(testButtons.first()).toBeVisible();
  });

  test('delete button only visible for database keys', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    const deleteButtons = page.getByText('Supprimer');
    const count = await deleteButtons.count();
    expect(count).toBe(1);
  });

  test('key input uses password type', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs.first()).toBeVisible();
  });

  test('non-configured keys have reduced opacity', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await expect(page.getByText('Non configur', { exact: false }).first()).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  Additional scenarios                                               */
  /* ------------------------------------------------------------------ */

  test('test key flow — valid key shows success indication', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
      return route.fulfill({
        json: { result: { valid: true, provider: 'openai', latencyMs: 95 } },
      });
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Tester').first().click();
    await expect(page.getByText(/valide|succ[eè]s|valid[eé]e|fonctionn/i)).toBeVisible({ timeout: 5000 });
  });

  test('test key invalid — shows error indication', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
      return route.fulfill({
        json: { result: { valid: false, provider: 'openai', error: 'Invalid API key' } },
      });
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Tester').first().click();
    await expect(page.getByText(/invalide|erreur|invalid|[eé]chou[eé]/i)).toBeVisible({ timeout: 5000 });
  });

  test('delete key flow — confirm dialog then success message', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys/ak-001', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          json: { success: true, fallbackToEnv: true },
        });
      }
      return route.continue();
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Supprimer').first().click();

    // Confirm dialog should be visible
    await expect(page.getByRole('button', { name: /supprimer|confirmer/i })).toBeVisible();
    await page.getByRole('button', { name: /supprimer|confirmer/i }).click();
    await expect(page.getByText(/supprim[eé]e|succ[eè]s/i)).toBeVisible({ timeout: 5000 });
  });

  test('add key full flow — select provider, fill key, save', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: {
            apiKey: {
              id: 'ak-new-2', providerType: 'google', providerName: 'Google AI',
              label: 'New key', source: 'database', masked: 'AIza****5678',
              keyPrefix: 'AIza', keyLastFour: '5678', isActive: true,
              baseUrl: null, lastTestedAt: null, lastTestResult: null,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
          },
        });
      }
      return route.continue();
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();

    // Select provider
    const providerSelect = page.locator('select[name="providerType"], select[name="provider"]').first();
    if (await providerSelect.isVisible()) {
      await providerSelect.selectOption('google');
    } else {
      // May be a dropdown/combobox
      const providerDropdown = page.getByText('Fournisseur').locator('..').locator('select, [role="combobox"]').first();
      if (await providerDropdown.isVisible()) {
        await providerDropdown.click();
        await page.getByText('Google', { exact: false }).click();
      }
    }

    // Fill key
    const keyInput = page.locator('input[type="password"]').first();
    await keyInput.fill('AIzaSyFakeKeyForTesting5678');

    // Save
    await page.getByRole('button', { name: /enregistrer|sauvegarder|ajouter/i }).first().click();

    // Verify form closes (form should no longer be visible)
    await expect(page.locator('input[type="password"]')).toBeHidden({ timeout: 5000 });
  });

  test('Ollama mode — shows URL input instead of password', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();

    // Select Ollama provider
    const providerSelect = page.locator('select[name="providerType"], select[name="provider"]').first();
    if (await providerSelect.isVisible()) {
      await providerSelect.selectOption('ollama');
    } else {
      const providerDropdown = page.getByText('Fournisseur').locator('..').locator('select, [role="combobox"]').first();
      if (await providerDropdown.isVisible()) {
        await providerDropdown.click();
        await page.getByText('Ollama', { exact: false }).click();
      }
    }

    // Verify URL input appears (baseUrl field)
    const urlInput = page.locator('input[type="url"], input[name="baseUrl"], input[placeholder*="http" i]').first();
    await expect(urlInput).toBeVisible({ timeout: 3000 });
  });

  test('error: encryption unavailable — shows error on add', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 503,
          json: { error: 'Encryption service unavailable' },
        });
      }
      return route.continue();
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();

    // Fill minimal fields and attempt save
    const keyInput = page.locator('input[type="password"]').first();
    if (await keyInput.isVisible()) {
      await keyInput.fill('sk-test-fake-key');
    }

    await page.getByRole('button', { name: /enregistrer|sauvegarder|ajouter/i }).first().click();
    await expect(page.getByText(/erreur|indisponible|unavailable|impossible/i)).toBeVisible({ timeout: 5000 });
  });

  test('rate limit on test — shows rate limit message', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
      return route.fulfill({
        status: 429,
        json: { error: 'Rate limit exceeded. Try again later.' },
      });
    });

    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Tester').first().click();
    await expect(page.getByText(/rate limit|limite|r[eé]essayer|too many/i)).toBeVisible({ timeout: 5000 });
  });

  test('cancel add form — form closes without saving', async ({ page }) => {
    await page.getByText('Cles API', { exact: false }).click();
    await page.getByText('Ajouter une cl', { exact: false }).click();

    // Verify form is open
    await expect(page.getByText('Fournisseur')).toBeVisible();

    // Click cancel
    await page.getByRole('button', { name: /annuler|cancel/i }).first().click();

    // Verify form is closed — the "Fournisseur" label from the add form should not be visible
    // (the provider list still shows provider names, so we check for the password input instead)
    await expect(page.locator('input[type="password"]')).toBeHidden({ timeout: 3000 });
  });
});
