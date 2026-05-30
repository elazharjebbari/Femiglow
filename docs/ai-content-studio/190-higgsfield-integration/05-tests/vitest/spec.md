# Vitest Test Plan -- Higgsfield AI Provider Integration

**Date:** 2026-05-27
**Framework:** Vitest + @testing-library/react (jsdom environment)
**Convention:** Follow existing patterns in `config-page.test.tsx` and `*.test.ts` files

---

## 1. Overview

This plan covers 4 test categories:

| Category          | File(s)                                           | Test count |
|-------------------|---------------------------------------------------|-----------|
| Adapter unit      | `providers/adapters/__tests__/higgsfield.test.ts`  | 12        |
| Services unit     | `services/*.test.ts` (amended)                    | 10        |
| API contract      | `test/api-contracts/ai-engine-higgsfield.contract.test.ts` | 8   |
| Component         | `config/__tests__/config-page.test.tsx` (amended) | 6         |

**Total: 36 tests**

---

## 2. Adapter Unit Tests

**File:** `src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts`

These test the `HiggsFieldAdapter` class in isolation, mocking `fetch`
for HTTP calls.

### 2.1 generateImage

```
Test: HF-ADAPT-001 — generateImage success
  Mock setup:
    - vi.spyOn(globalThis, 'fetch') returns 200 with
      { images: [{ url: 'https://cdn.higgsfield.ai/img-001.png' }] }
  Assertions:
    - Result status is 'success'
    - Result data contains image URL
    - fetch was called with POST to https://api.higgsfield.ai/v1/images/generate
    - Authorization header is 'Bearer <apiKey>'
    - Body contains { model: 'higgsfield-diffusion-v2', prompt, width, height }

Test: HF-ADAPT-002 — generateImage error (401 invalid key)
  Mock setup:
    - fetch returns 401 with { error: 'Invalid API key' }
  Assertions:
    - Result status is 'error'
    - Error message contains 'Invalid API key' or '401'
    - Error is NOT marked as retryable

Test: HF-ADAPT-003 — generateImage timeout
  Mock setup:
    - fetch rejects with AbortError after TIMEOUT_MS
  Assertions:
    - Result status is 'error'
    - Error message contains 'timeout' or 'aborted'
    - Error is marked as retryable

Test: HF-ADAPT-004 — generateImage 500 triggers retry
  Mock setup:
    - fetch returns 500 on first call, 200 on second call
    - retryPolicy configured with maxRetries: 1
  Assertions:
    - fetch called exactly 2 times
    - Final result is 'success'
```

### 2.2 generateVideo

```
Test: HF-ADAPT-005 — generateVideo success (synchronous)
  Mock setup:
    - fetch returns 200 with { video: { url: 'https://cdn.higgsfield.ai/vid-001.mp4' } }
  Assertions:
    - Result status is 'success'
    - Result data contains video URL
    - POST to https://api.higgsfield.ai/v1/videos/generate

Test: HF-ADAPT-006 — generateVideo success (async polling)
  Mock setup:
    - POST /v1/videos/generate returns 202 with { jobId: 'job-123', status: 'processing' }
    - GET /v1/videos/job-123 returns { status: 'processing' } on first call
    - GET /v1/videos/job-123 returns { status: 'completed', video: { url: '...' } } on second call
  Assertions:
    - Result status is 'success'
    - fetch called 3 times (1 POST + 2 GETs)
    - Poll interval was respected

Test: HF-ADAPT-007 — generateVideo timeout during polling
  Mock setup:
    - POST returns 202 (accepted)
    - GET always returns { status: 'processing' }
    - Polling timeout set to 100ms for test
  Assertions:
    - Result status is 'error'
    - Error message contains 'timeout' or 'exceeded'
```

### 2.3 Circuit Breaker

```
Test: HF-ADAPT-008 — circuit breaker opens after threshold failures
  Mock setup:
    - fetch returns 500 for failureThreshold consecutive calls
  Assertions:
    - First N calls go through to fetch
    - Call N+1 immediately rejects with circuit breaker error
    - fetch is NOT called for the rejected call

Test: HF-ADAPT-009 — circuit breaker half-open allows probe
  Mock setup:
    - Circuit breaker is in open state
    - resetTimeoutMs elapses
    - Next call returns 200
  Assertions:
    - Probe call goes through to fetch
    - Circuit breaker transitions to closed state
    - Subsequent calls succeed normally
```

### 2.4 Cost Calculation

```
Test: HF-ADAPT-010 — cost calculation for image generation
  Mock setup:
    - Adapter configured with costPerUnit: 500
  Assertions:
    - Result costCents equals 500 (per-image cost)

Test: HF-ADAPT-011 — cost calculation for video generation
  Mock setup:
    - Adapter configured with costPerUnit: 2000
  Assertions:
    - Result costCents equals 2000 (per-video cost)
```

### 2.5 Unsupported Operations

```
Test: HF-ADAPT-012 — generateText throws NotImplementedError
  Assertions:
    - Calling adapter.generateText() throws error with 'not implemented'
    - Calling adapter.generateEmbedding() throws error with 'not implemented'
```

---

## 3. Services Unit Tests

### 3.1 api-key-validator.ts

**File:** `src/lib/ai-engine/services/api-key-validator.test.ts` (amend existing)

```
Test: HF-VALID-001 — testHiggsfield valid key
  File: api-key-validator.test.ts
  Mock setup:
    - vi.spyOn(globalThis, 'fetch') returns 200 from
      https://api.higgsfield.ai/v1/models (or health endpoint)
  Assertions:
    - validateApiKey('higgsfield', 'hf-valid-key') returns { valid: true }
    - provider is 'higgsfield'
    - latencyMs is a positive number

Test: HF-VALID-002 — testHiggsfield invalid key (401)
  File: api-key-validator.test.ts
  Mock setup:
    - fetch returns 401 from Higgsfield health endpoint
  Assertions:
    - validateApiKey('higgsfield', 'hf-bad-key') returns { valid: false }
    - error contains '401' or 'Invalid'

Test: HF-VALID-003 — testHiggsfield timeout
  File: api-key-validator.test.ts
  Mock setup:
    - fetch rejects with AbortError
  Assertions:
    - Returns { valid: false, error: <timeout message> }
```

### 3.2 api-key-manager.ts

**File:** `src/lib/ai-engine/services/api-key-manager.test.ts` (amend existing)

```
Test: HF-MNGR-001 — PROVIDER_NAMES includes higgsfield
  File: api-key-manager.test.ts
  Assertions:
    - Import PROVIDER_NAMES (or test via listApiKeys output)
    - Higgsfield entry maps to 'Higgsfield AI'

Test: HF-MNGR-002 — ENV_KEY_MAP includes higgsfield
  File: api-key-manager.test.ts
  Assertions:
    - ENV_KEY_MAP['higgsfield'] contains 'AI_ENGINE_HIGGSFIELD_API_KEY'

Test: HF-MNGR-003 — listApiKeys returns Higgsfield entry
  File: api-key-manager.test.ts
  Mock setup:
    - Mock db() to return empty array (no DB keys)
    - Set process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf-test-key'
  Assertions:
    - Result array includes entry with providerType='higgsfield'
    - source is 'env'
    - providerName is 'Higgsfield AI'

Test: HF-MNGR-004 — listApiKeys returns none when no key set
  File: api-key-manager.test.ts
  Mock setup:
    - No DB key, no env var for Higgsfield
  Assertions:
    - Higgsfield entry has source='none'
    - masked is empty string
    - isActive is false
```

### 3.3 model-discovery.ts

**File:** `src/lib/ai-engine/services/model-discovery.test.ts` (amend existing)

```
Test: HF-DISC-001 — FALLBACK_MODELS includes higgsfield
  File: model-discovery.test.ts
  Assertions:
    - FALLBACK_MODELS['higgsfield'] is defined
    - Contains { id: 'higgsfield-diffusion-v2', role: 'image' }
    - Contains { id: 'higgsfield-video-v1', role: 'video' }

Test: HF-DISC-002 — discoverModels('higgsfield') returns fallback on error
  File: model-discovery.test.ts
  Mock setup:
    - fetch rejects with network error
  Assertions:
    - Returns { models: FALLBACK_MODELS.higgsfield, source: 'fallback' }

Test: HF-DISC-003 — discoverModels('higgsfield') caches live result
  File: model-discovery.test.ts
  Mock setup:
    - fetch returns 200 with model list from Higgsfield API
  Assertions:
    - First call: source is 'live', fetch called once
    - Second call within TTL: source is 'cache', fetch NOT called again
```

---

## 4. API Contract Tests

**File:** `src/test/api-contracts/ai-engine-higgsfield.contract.test.ts`

These tests verify the API route handlers return correct data for
Higgsfield, using MSW for mocking.

```
Test: HF-API-001 — GET /config/providers includes Higgsfield default
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler for GET /config/providers returns provider list
      including default-higgsfield entry
  Assertions:
    - Response contains provider with providerType='higgsfield'
    - Provider has capabilities=['image','video']
    - Provider has priority=15
    - Provider has 2 models (higgsfield-diffusion-v2, higgsfield-video-v1)

Test: HF-API-002 — GET /config/providers/models?provider=higgsfield returns models
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler for GET /config/providers/models responds to
      provider=higgsfield with model list
  Assertions:
    - Response has { models: [...], source: 'live'|'fallback' }
    - Models include { id: 'higgsfield-diffusion-v2', role: 'image' }
    - Models include { id: 'higgsfield-video-v1', role: 'video' }

Test: HF-API-003 — GET /config/providers/models?provider=higgsfield&capability=image filters
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - Same handler with capability filter
  Assertions:
    - Only image models returned (higgsfield-diffusion-v2)
    - Video model is filtered out

Test: HF-API-004 — POST /config/api-keys with providerType=higgsfield
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler for POST /config/api-keys
  Request body:
    { providerType: 'higgsfield', apiKey: 'hf-test-key-123', label: 'Test' }
  Assertions:
    - Response status 201
    - Response body has apiKey.providerType === 'higgsfield'
    - apiKey.source === 'database'

Test: HF-API-005 — POST /config/api-keys/test with providerType=higgsfield (valid)
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler returns { result: { valid: true, provider: 'higgsfield', latencyMs: 95 } }
  Request body:
    { providerType: 'higgsfield' }
  Assertions:
    - Response has result.valid === true
    - result.provider === 'higgsfield'

Test: HF-API-006 — POST /config/api-keys/test with providerType=higgsfield (invalid)
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler returns { result: { valid: false, provider: 'higgsfield', error: 'Invalid API key' } }
  Assertions:
    - result.valid === false
    - result.error is a non-empty string

Test: HF-API-007 — DELETE /config/api-keys/:id for Higgsfield key
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler for DELETE /config/api-keys/:id
  Assertions:
    - Response has { success: true }

Test: HF-API-008 — GET /config/api-keys includes Higgsfield entry
  File: ai-engine-higgsfield.contract.test.ts
  Mock setup:
    - MSW handler returns apiKeys array including Higgsfield
  Assertions:
    - Array contains entry with providerType='higgsfield'
    - providerName is 'Higgsfield AI'
    - source is one of 'database' | 'env' | 'none'
```

---

## 5. Component Tests (Config Page)

**File:** `src/app/admin/content-studio-v2/ai-engine/config/__tests__/config-page.test.tsx` (amend existing)

```
Test: HF-UI-001 — Higgsfield provider card renders in grid
  File: config-page.test.tsx
  Mock setup:
    - fetchResponses.providers includes buildProvider({
        id: 'prov_higgsfield',
        name: 'Higgsfield AI',
        providerType: 'higgsfield',
        capabilities: ['image', 'video'],
        models: [
          { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
          { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
        ],
        priority: 15,
        configured: true,
        healthStatus: 'healthy',
      })
  Assertions:
    - screen.getByText('Higgsfield AI') is in document
    - screen.getByText('Image') is in document (capability badge)
    - screen.getByText(/Vid/) is in document (capability badge)
    - screen.getByText('higgsfield-diffusion-v2') is in document
    - screen.getByText('higgsfield-video-v1') is in document
    - screen.getByText(/Priorite 15/) is in document

Test: HF-UI-002 — Higgsfield edit form opens with ModelSelector
  File: config-page.test.tsx
  Mock setup:
    - Same provider as HF-UI-001
  Steps:
    - Render page
    - Click the "Editer" button on the Higgsfield card
  Assertions:
    - screen.getByTestId('model-selector') is in document
    - screen.getByText(/ModelSelector\[higgsfield\]/) is in document
    - screen.getByText('Sauvegarder') is in document

Test: HF-UI-003 — Higgsfield model costs displayed
  File: config-page.test.tsx
  Mock setup:
    - Same provider as HF-UI-001
  Assertions:
    - screen.getByText('5c/u') is in document (500 / 100 = 5)
    - screen.getByText('20c/u') is in document (2000 / 100 = 20)

Test: HF-UI-004 — Higgsfield shows in Cles API tab
  File: config-page.test.tsx
  Mock setup:
    - fetchResponses.apiKeys includes buildApiKeyInfo({
        providerType: 'higgsfield',
        providerName: 'Higgsfield AI',
        source: 'database',
        masked: 'hf-****ab12',
      })
  Steps:
    - Switch to Cles API tab
  Assertions:
    - screen.getByText('Higgsfield AI') is in document
    - screen.getByText('hf-****ab12') is in document
    - screen.getByText('Base de donnees') is in document

Test: HF-UI-005 — Higgsfield unconfigured key shows "Non configure"
  File: config-page.test.tsx
  Mock setup:
    - Higgsfield entry with source='none'
  Assertions:
    - Card for Higgsfield has "Non configure" badge
    - No "Tester" button for this entry
    - No "Supprimer" button for this entry

Test: HF-UI-006 — Stat card "Cles configurees" includes Higgsfield
  File: config-page.test.tsx
  Mock setup:
    - apiKeys includes Higgsfield with source='database' (i.e. configured)
    - Total configured keys = 3 (openai, anthropic, higgsfield)
  Assertions:
    - Stat card value for "Cles configurees" is 3
```

---

## 6. Test Utilities

### 6.1 Builder Additions

Add to the existing `buildProvider()` helper in `config-page.test.tsx`:

```typescript
function buildHiggsfield(overrides?: Record<string, unknown>) {
  return buildProvider({
    id: 'prov_higgsfield',
    providerType: 'higgsfield',
    name: 'Higgsfield AI',
    apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
    capabilities: ['image', 'video'],
    models: [
      { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
      { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 20,
    priority: 15,
    configured: true,
    healthStatus: 'healthy',
    ...overrides,
  });
}
```

### 6.2 API Key Builder

```typescript
function buildHiggsFieldKey(overrides?: Record<string, unknown>) {
  return buildApiKeyInfo({
    id: 'ak_hf',
    providerType: 'higgsfield',
    providerName: 'Higgsfield AI',
    label: 'Production key',
    source: 'database',
    masked: 'hf-****ab12',
    keyPrefix: 'hf-',
    keyLastFour: 'ab12',
    ...overrides,
  });
}
```

---

## 7. Running the Tests

```bash
# All Higgsfield-related tests
npx vitest run --grep "HF-|higgsfield|Higgsfield"

# Adapter tests only
npx vitest run src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts

# Services tests (amended files)
npx vitest run src/lib/ai-engine/services/api-key-validator.test.ts
npx vitest run src/lib/ai-engine/services/api-key-manager.test.ts
npx vitest run src/lib/ai-engine/services/model-discovery.test.ts

# Contract tests
npx vitest run src/test/api-contracts/ai-engine-higgsfield.contract.test.ts

# Component tests
npx vitest run src/app/admin/content-studio-v2/ai-engine/config/__tests__/config-page.test.tsx
```

---

## 8. Coverage Targets

| Module                          | Target   |
|---------------------------------|----------|
| `adapters/higgsfield.ts`        | >= 95%   |
| `api-key-validator.ts` (case)   | 100%     |
| `api-key-manager.ts` (entries)  | 100%     |
| `model-discovery.ts` (entries)  | >= 90%   |
| Config page (Higgsfield paths)  | >= 85%   |
