# E2E Playwright Test Plan -- Higgsfield AI Provider Integration

**Date:** 2026-05-27
**Framework:** Playwright (@playwright/test)
**Convention:** Follow existing patterns in `ai-engine-config-providers.spec.ts`
**Target file:** `e2e/content-studio-v2/ai-engine-config-higgsfield.spec.ts`

---

## 1. Overview

These E2E tests verify the complete user journey for the Higgsfield
provider in the Config UI, using `page.route()` mocks to intercept API
calls. No real backend is required.

**Total tests: 12**

---

## 2. Mock Data Setup

### 2.1 MOCK_PROVIDERS (with Higgsfield)

```typescript
const MOCK_PROVIDERS = {
  providers: [
    {
      id: 'prov-openai',
      providerType: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
      baseUrl: null,
      capabilities: ['text', 'image', 'embedding'],
      models: [
        { name: 'gpt-4o-mini', capability: 'text', costPer1MInput: 15 },
      ],
      rateLimitRpm: 500,
      dailyBudgetCents: 500,
      circuitBreakerConfig: null,
      priority: 10,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString(),
      configured: true,
    },
    {
      id: 'prov-higgsfield',
      providerType: 'higgsfield',
      name: 'Higgsfield AI',
      apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
      baseUrl: 'https://api.higgsfield.ai',
      capabilities: ['image', 'video'],
      models: [
        { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
        { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
      ],
      rateLimitRpm: 60,
      dailyBudgetCents: 20,
      circuitBreakerConfig: null,
      priority: 15,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
      lastHealthCheck: new Date().toISOString(),
      configured: true,
    },
  ],
};
```

### 2.2 MOCK_API_KEYS (with Higgsfield)

```typescript
const MOCK_API_KEYS = {
  apiKeys: [
    {
      id: 'ak-001',
      providerType: 'openai',
      providerName: 'OpenAI',
      label: 'Production key',
      source: 'database',
      masked: 'sk-proj-****abc1',
      keyPrefix: 'sk-proj-',
      keyLastFour: 'abc1',
      isActive: true,
      baseUrl: null,
      lastTestedAt: new Date().toISOString(),
      lastTestResult: 'valid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ak-hf-001',
      providerType: 'higgsfield',
      providerName: 'Higgsfield AI',
      label: 'Higgsfield Production',
      source: 'database',
      masked: 'hf-****ab12',
      keyPrefix: 'hf-',
      keyLastFour: 'ab12',
      isActive: true,
      baseUrl: null,
      lastTestedAt: null,
      lastTestResult: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};
```

### 2.3 Route Setup Function

```typescript
async function setupHiggsfieldMocks(page: Page) {
  await page.route('**/api/admin/ai-engine/config/providers', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: MOCK_PROVIDERS });
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: { success: true, provider: MOCK_PROVIDERS.providers[1] },
      });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/workflows', (route) => {
    return route.fulfill({ json: { workflows: [] } });
  });

  await page.route('**/api/admin/ai-engine/config/prompts', (route) => {
    return route.fulfill({ json: { prompts: [] } });
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
            id: 'ak-hf-new',
            providerType: 'higgsfield',
            providerName: 'Higgsfield AI',
            label: 'New key',
            source: 'database',
            masked: 'hf-****new1',
            keyPrefix: 'hf-',
            keyLastFour: 'new1',
            isActive: true,
            baseUrl: null,
            lastTestedAt: null,
            lastTestResult: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/api-keys/test', (route) => {
    return route.fulfill({
      json: { result: { valid: true, provider: 'higgsfield', latencyMs: 95 } },
    });
  });

  await page.route('**/api/admin/ai-engine/config/api-keys/*', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: { success: true, fallbackToEnv: false } });
    }
    return route.continue();
  });

  await page.route('**/api/admin/ai-engine/config/providers/models*', (route) => {
    const url = new URL(route.request().url());
    const provider = url.searchParams.get('provider');
    if (provider === 'higgsfield') {
      return route.fulfill({
        json: {
          models: [
            { id: 'higgsfield-diffusion-v2', role: 'image' },
            { id: 'higgsfield-video-v1', role: 'video' },
          ],
          source: 'live',
        },
      });
    }
    return route.fulfill({
      json: { models: [{ id: 'gpt-4o-mini', role: 'chat' }], source: 'live' },
    });
  });

  await page.route('**/api/admin/ai-engine/health', (route) => {
    return route.fulfill({ json: { enabled: true } });
  });
}
```

---

## 3. Test Specifications

### 3.1 Fournisseurs Tab -- Provider Card

```
Test: HF-E2E-001 — Navigate to Config, Higgsfield card visible
  Steps:
    1. setupHiggsfieldMocks(page)
    2. gotoAIEngine(page, 'config')
    3. Wait for "Higgsfield AI" to be visible
  Assertions:
    - page.getByText('Higgsfield AI').toBeVisible()
    - page.getByText('OpenAI').toBeVisible()

Test: HF-E2E-002 — Higgsfield card shows image + video badges
  Steps:
    1. Navigate to config
    2. Locate Higgsfield card area
  Assertions:
    - page.getByText('Image').first().toBeVisible()
    - page.getByText('Video').toBeVisible()  (French: "Video")
    - Both badges use correct colors (visual check optional)

Test: HF-E2E-003 — Higgsfield card shows model list with costs
  Steps:
    1. Navigate to config
  Assertions:
    - page.getByText('higgsfield-diffusion-v2').toBeVisible()
    - page.getByText('higgsfield-video-v1').toBeVisible()
    - page.getByText('5c/u').toBeVisible()
    - page.getByText('20c/u').toBeVisible()

Test: HF-E2E-004 — Higgsfield card shows priority and budget
  Steps:
    1. Navigate to config
  Assertions:
    - page.getByText(/Priorit.*15/).toBeVisible()
    - page.getByText('60/min').toBeVisible()
    - page.getByText('0.20 MAD/j').toBeVisible()
```

### 3.2 Fournisseurs Tab -- Edit Form

```
Test: HF-E2E-005 — Click Edit, form opens with ModelSelector
  Steps:
    1. Navigate to config
    2. Find the "Editer" button in/near the Higgsfield card
    3. Click it
  Assertions:
    - page.getByText('Priorit', { exact: false }).toBeVisible()
    - page.getByText('Budget quotidien', { exact: false }).toBeVisible()
    - page.getByText('Rate limit', { exact: false }).toBeVisible()
    - page.getByText('Modeles', { exact: false }).toBeVisible()
    - No "URL de base Ollama" visible (Higgsfield is not Ollama)

Test: HF-E2E-006 — Save provider edit succeeds
  Steps:
    1. Open Higgsfield edit form
    2. Change priority input to 5
    3. Click "Sauvegarder"
  Assertions:
    - page.getByText('Configuration sauvegard', { exact: false }).toBeVisible({ timeout: 5000 })
    - POST to /config/providers was intercepted
  Verification:
    - Capture intercepted request body
    - Assert body contains { priority: 5 }

Test: HF-E2E-007 — ModelSelector shows Higgsfield models
  Steps:
    1. Open Higgsfield edit form
    2. Click the ModelSelector trigger button (the multi-select)
    3. Wait for popover to appear
  Assertions:
    - Popover contains "higgsfield-diffusion-v2"
    - Popover contains "higgsfield-video-v1"
    - Role badges [IMAGE] and [VIDEO] are visible
    - Footer shows "Live" source indicator
  Note:
    - ModelSelector uses Radix Popover portal. Use page.locator('[role="listbox"]')
      or the cmdk Command.List for assertions.
```

### 3.3 Cles API Tab

```
Test: HF-E2E-008 — Navigate to Cles API, Higgsfield row visible
  Steps:
    1. Navigate to config
    2. Click "Cles API" tab
    3. Wait for key cards to load
  Assertions:
    - page.getByText('Higgsfield AI').toBeVisible()
    - page.getByText('hf-****ab12').toBeVisible()
    - page.getByText('Base de donn', { exact: false }).toBeVisible() (badge)

Test: HF-E2E-009 — Test Higgsfield API key
  Steps:
    1. Navigate to Cles API tab
    2. Find "Tester" button next to Higgsfield entry
    3. Click it
  Assertions:
    - POST /config/api-keys/test was called with { providerType: 'higgsfield' }
    - Toast "higgsfield" appears (partial match sufficient)
    - Toast contains "Cle valide" or latency info
  Interceptor check:
    - Use page.waitForRequest() to capture the test request body

Test: HF-E2E-010 — Delete Higgsfield API key
  Steps:
    1. Navigate to Cles API tab
    2. Click "Supprimer" button on Higgsfield key card
    3. Confirmation banner appears
    4. Click "Supprimer" in the confirmation banner
  Assertions:
    - Confirmation text "Supprimer la cle Higgsfield AI" appears
    - DELETE request sent to /config/api-keys/ak-hf-001
    - Key list re-fetches (GET /config/api-keys called again)

Test: HF-E2E-011 — Add Higgsfield API key
  Precondition:
    - Modify MOCK_API_KEYS to have Higgsfield with source='none'
  Steps:
    1. Navigate to Cles API tab
    2. Click "Ajouter une cle"
    3. Select "Higgsfield AI" from provider dropdown (requires option to exist)
    4. Enter API key "hf-new-key-12345"
    5. Click "Enregistrer"
  Assertions:
    - POST /config/api-keys called with { providerType: 'higgsfield', apiKey: 'hf-new-key-12345' }
    - Toast "Cle API enregistree" appears
    - Form closes
  Note:
    - This test requires the <option value="higgsfield"> to exist in the form.
      If it doesn't yet exist, this test documents the expected behavior once
      the option is added (see frontend spec section 5.3).
```

### 3.4 Stat Cards

```
Test: HF-E2E-012 — Stat cards reflect Higgsfield in counts
  Steps:
    1. Navigate to config
  Assertions:
    - "Fournisseurs actifs" shows "2/2" (both OpenAI and Higgsfield configured)
    - Total budget: (500 + 20) / 100 = "5 MAD" (rounded)
    - "Cles configurees" shows count that includes Higgsfield
```

---

## 4. Error Scenarios

These extend the happy-path tests with error-specific route overrides.

```
Test: HF-E2E-ERR-001 — Save provider edit fails (500)
  Override:
    - page.route POST /config/providers => { status: 500, json: { error: 'Server error' } }
  Steps:
    1. Open Higgsfield edit form
    2. Click "Sauvegarder"
  Assertions:
    - page.getByText('Erreur lors de la sauvegarde').toBeVisible()
    - Form remains open

Test: HF-E2E-ERR-002 — Test API key returns invalid
  Override:
    - page.route POST /config/api-keys/test =>
      { json: { result: { valid: false, provider: 'higgsfield', error: 'Invalid API key' } } }
  Steps:
    1. Go to Cles API tab
    2. Click "Tester" on Higgsfield card
  Assertions:
    - Error toast appears (toast.error called)

Test: HF-E2E-ERR-003 — Delete API key 404
  Override:
    - page.route DELETE /config/api-keys/* => { status: 404, json: { error: 'Not found' } }
  Steps:
    1. Go to Cles API tab
    2. Click "Supprimer" then confirm
  Assertions:
    - Error toast appears
```

---

## 5. Test Infrastructure Notes

### 5.1 Authentication

Tests use `test.use({ storageState: ADMIN_STORAGE_PATH })` to bypass login,
consistent with existing E2E tests.

### 5.2 Navigation Helper

```typescript
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.beforeEach(async ({ page }) => {
  const ok = await ensureAuthOrSkip(page);
  if (!ok) test.skip();
  await setupHiggsfieldMocks(page);
  await gotoAIEngine(page, 'config');
});
```

### 5.3 Timeout Strategy

- Provider card visibility: `{ timeout: 10_000 }` (initial load)
- Form interactions: `{ timeout: 5_000 }` (after user action)
- Toast assertions: `{ timeout: 5_000 }`

### 5.4 Request Interception

For tests that need to verify request bodies:

```typescript
const [request] = await Promise.all([
  page.waitForRequest((req) =>
    req.url().includes('/config/api-keys/test') && req.method() === 'POST'
  ),
  page.getByText('Tester').nth(1).click(),
]);
const body = request.postDataJSON();
expect(body.providerType).toBe('higgsfield');
```

---

## 6. Running the Tests

```bash
# All Higgsfield E2E tests
npx playwright test e2e/content-studio-v2/ai-engine-config-higgsfield.spec.ts

# With UI mode for debugging
npx playwright test e2e/content-studio-v2/ai-engine-config-higgsfield.spec.ts --ui

# Specific test by title
npx playwright test -g "Higgsfield card visible"
```
