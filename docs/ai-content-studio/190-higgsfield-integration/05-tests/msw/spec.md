# MSW Handler Specification -- Higgsfield AI Provider Integration

**Date:** 2026-05-27
**File to amend:** `src/test/msw/ai-engine-handlers.ts`
**Framework:** MSW v2 (`msw/node`)

---

## 1. Overview

This document specifies all MSW (Mock Service Worker) handler additions
needed to support Higgsfield AI in the test suite. Changes are limited to
mock data constants and handler logic; no new handler files are needed.

---

## 2. Mock Data Additions

### 2.1 MOCK_PROVIDERS -- Add Higgsfield Entry

Add to the existing `MOCK_PROVIDERS` array (after the Anthropic entry):

```typescript
const MOCK_PROVIDERS = [
  // ... existing OpenAI entry (prov-001) ...
  // ... existing Anthropic entry (prov-002) ...
  {
    id: 'prov-003',
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
];
```

### 2.2 MOCK_MODEL_DISCOVERY -- Add Higgsfield Models

Add to the existing `MOCK_MODEL_DISCOVERY` record:

```typescript
const MOCK_MODEL_DISCOVERY: Record<string, { models: Array<{ id: string; role: string }>; source: 'live' | 'fallback' }> = {
  // ... existing openai, anthropic, google, ollama, elevenlabs entries ...
  higgsfield: {
    models: [
      { id: 'higgsfield-diffusion-v2', role: 'image' },
      { id: 'higgsfield-video-v1', role: 'video' },
    ],
    source: 'live',
  },
};
```

### 2.3 MOCK_API_KEYS -- Add Higgsfield Variants

Add three Higgsfield variants to support different test scenarios:

**Database variant (default):**

```typescript
{
  id: 'ak-hf-001',
  providerType: 'higgsfield',
  providerName: 'Higgsfield AI',
  label: 'Higgsfield Production',
  source: 'database' as const,
  masked: 'hf-****ab12',
  keyPrefix: 'hf-',
  keyLastFour: 'ab12',
  isActive: true,
  baseUrl: null,
  lastTestedAt: new Date().toISOString(),
  lastTestResult: 'valid',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
```

**Environment variable variant:**

```typescript
const MOCK_HIGGSFIELD_KEY_ENV = {
  id: null,
  providerType: 'higgsfield',
  providerName: 'Higgsfield AI',
  label: "Variable d'environnement",
  source: 'env' as const,
  masked: 'hf-****cd34',
  keyPrefix: 'hf-',
  keyLastFour: 'cd34',
  isActive: true,
  baseUrl: null,
  lastTestedAt: null,
  lastTestResult: null,
  createdAt: null,
  updatedAt: null,
};
```

**Unconfigured variant:**

```typescript
const MOCK_HIGGSFIELD_KEY_NONE = {
  id: null,
  providerType: 'higgsfield',
  providerName: 'Higgsfield AI',
  label: 'Non configure',
  source: 'none' as const,
  masked: '',
  keyPrefix: '',
  keyLastFour: '',
  isActive: false,
  baseUrl: null,
  lastTestedAt: null,
  lastTestResult: null,
  createdAt: null,
  updatedAt: null,
};
```

### 2.4 MOCK_HEALTH -- Add Higgsfield to Providers

```typescript
const MOCK_HEALTH = {
  enabled: true,
  providers: {
    text: { configured: true, provider: 'openai' },
    image: { configured: true, provider: 'higgsfield' },  // Changed from 'mock'
    video: { configured: true, provider: 'higgsfield' },  // Changed from 'mock'
    tts: { configured: true, provider: 'mock' },
  },
  budget: { dailyCents: 1000, maxPerJobCents: 100 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  version: '1.0.0-mvp',
  timestamp: new Date().toISOString(),
};
```

---

## 3. Handler Modifications

### 3.1 Existing Handler: GET /config/providers

**Current behavior:** Returns `MOCK_PROVIDERS` (OpenAI + Anthropic).
**After change:** Returns `MOCK_PROVIDERS` including Higgsfield entry.
**No code change needed** -- the handler returns the constant, so just
adding Higgsfield to `MOCK_PROVIDERS` is sufficient.

### 3.2 Existing Handler: GET /config/providers/models

**Current handler:** `modelDiscoveryHandlers[0]` in the `modelDiscoveryHandlers` array.
**Current behavior:** Reads `provider` from query params and looks up
`MOCK_MODEL_DISCOVERY[provider]`. Returns 400 if not found.
**After change:** Adding `higgsfield` to `MOCK_MODEL_DISCOVERY` makes it
work automatically.

With the addition, these requests now succeed:

```
GET /config/providers/models?provider=higgsfield
  -> { models: [{ id: 'higgsfield-diffusion-v2', role: 'image' }, { id: 'higgsfield-video-v1', role: 'video' }], source: 'live' }

GET /config/providers/models?provider=higgsfield&capability=image
  -> { models: [{ id: 'higgsfield-diffusion-v2', role: 'image' }], source: 'live' }
  (filtered by the existing roleMap: image -> image)

GET /config/providers/models?provider=higgsfield&capability=video
  -> { models: [{ id: 'higgsfield-video-v1', role: 'video' }], source: 'live' }
  (requires adding 'video' to roleMap in the handler)
```

**Required roleMap update (line ~548):**

```typescript
const roleMap: Record<string, string> = {
  text: 'chat',
  chat: 'chat',
  embedding: 'embedding',
  image: 'image',
  tts: 'tts',
  vision: 'vision',
  code: 'code',
  video: 'video',  // ADD THIS LINE
};
```

### 3.3 Existing Handler: GET /config/api-keys

**Current behavior:** Returns `MOCK_API_KEYS` (openai, anthropic, google,
elevenlabs, ollama).
**After change:** Add the Higgsfield database key entry to `MOCK_API_KEYS`.

### 3.4 Existing Handler: POST /config/api-keys

**Current behavior:** Creates a new key with providerType from body.
**After change:** Works as-is. The handler reads `body.providerType` and
returns it in the response. No Higgsfield-specific logic needed.

### 3.5 Existing Handler: POST /config/api-keys/test

**Current behavior:** Returns `{ result: { valid: true, provider: body.providerType, latencyMs: 150 } }`.
**After change:** Works as-is for Higgsfield (provider-agnostic response).

### 3.6 Existing Handler: DELETE /config/api-keys/:id

**Current behavior:** Returns `{ success: true, fallbackToEnv: false }`.
**After change:** Works as-is.

---

## 4. New Error Handlers

Add to the existing error handler objects.

### 4.1 Higgsfield-specific API Key Errors

Add to `apiKeysErrorHandlers`:

```typescript
export const apiKeysErrorHandlers = {
  // ... existing handlers ...

  testHiggsfield401: http.post(`${BASE}/config/api-keys/test`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (body.providerType === 'higgsfield') {
      return HttpResponse.json({
        result: {
          valid: false,
          provider: 'higgsfield',
          latencyMs: 200,
          error: 'Invalid Higgsfield API key',
        },
      });
    }
    // Fallback to valid for other providers
    return HttpResponse.json({
      result: { valid: true, provider: body.providerType, latencyMs: 150 },
    });
  }),

  testHiggsfield500: http.post(`${BASE}/config/api-keys/test`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (body.providerType === 'higgsfield') {
      return HttpResponse.json(
        { error: 'Higgsfield API unreachable' },
        { status: 500 },
      );
    }
    return HttpResponse.json({
      result: { valid: true, provider: body.providerType, latencyMs: 150 },
    });
  }),

  testHiggsFieldTimeout: http.post(`${BASE}/config/api-keys/test`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (body.providerType === 'higgsfield') {
      await new Promise((r) => setTimeout(r, 15000));
      return HttpResponse.json({
        result: { valid: false, provider: 'higgsfield', latencyMs: 15000, error: 'Timeout' },
      });
    }
    return HttpResponse.json({
      result: { valid: true, provider: body.providerType, latencyMs: 150 },
    });
  }),
};
```

### 4.2 Higgsfield Model Discovery Errors

Add to `modelDiscoveryErrorHandlers`:

```typescript
export const modelDiscoveryErrorHandlers = {
  // ... existing handlers ...

  higgsfield500: http.get(`${BASE}/config/providers/models`, ({ request }) => {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');
    if (provider === 'higgsfield') {
      return HttpResponse.json(
        { error: 'Higgsfield model discovery failed' },
        { status: 500 },
      );
    }
    // Fallback for other providers
    const discovery = MOCK_MODEL_DISCOVERY[provider ?? ''];
    if (discovery) {
      return HttpResponse.json({ models: discovery.models, source: discovery.source });
    }
    return HttpResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }),

  higgsfieldFallback: http.get(`${BASE}/config/providers/models`, ({ request }) => {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');
    if (provider === 'higgsfield') {
      return HttpResponse.json({
        models: [
          { id: 'higgsfield-diffusion-v2', role: 'image' },
          { id: 'higgsfield-video-v1', role: 'video' },
        ],
        source: 'fallback' as const,
      });
    }
    const discovery = MOCK_MODEL_DISCOVERY[provider ?? ''];
    if (discovery) {
      return HttpResponse.json({ models: discovery.models, source: discovery.source });
    }
    return HttpResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }),
};
```

### 4.3 Higgsfield Provider Update Errors

Add to `aiEngineErrorHandlers`:

```typescript
export const aiEngineErrorHandlers = {
  // ... existing handlers ...

  providerUpdateHiggsfield500: http.post(`${BASE}/config/providers`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (body.id === 'prov-003' || body.providerType === 'higgsfield') {
      return HttpResponse.json(
        { error: 'Failed to update Higgsfield configuration' },
        { status: 500 },
      );
    }
    return HttpResponse.json({ provider: body });
  }),
};
```

---

## 5. Complete JSON Mock Data Structures

### 5.1 Higgsfield Provider (full shape)

```json
{
  "id": "prov-003",
  "providerType": "higgsfield",
  "name": "Higgsfield AI",
  "apiKeyEnvVar": "AI_ENGINE_HIGGSFIELD_API_KEY",
  "baseUrl": "https://api.higgsfield.ai",
  "capabilities": ["image", "video"],
  "models": [
    {
      "name": "higgsfield-diffusion-v2",
      "capability": "image",
      "costPerUnit": 500
    },
    {
      "name": "higgsfield-video-v1",
      "capability": "video",
      "costPerUnit": 2000
    }
  ],
  "rateLimitRpm": 60,
  "dailyBudgetCents": 20,
  "circuitBreakerConfig": null,
  "priority": 15,
  "isFallback": false,
  "isEnabled": true,
  "healthStatus": "healthy",
  "lastHealthCheck": "2026-05-27T12:00:00.000Z",
  "configured": true
}
```

### 5.2 Higgsfield Model Discovery Response

```json
{
  "models": [
    { "id": "higgsfield-diffusion-v2", "role": "image" },
    { "id": "higgsfield-video-v1", "role": "video" }
  ],
  "source": "live"
}
```

### 5.3 Higgsfield API Key (database)

```json
{
  "id": "ak-hf-001",
  "providerType": "higgsfield",
  "providerName": "Higgsfield AI",
  "label": "Higgsfield Production",
  "source": "database",
  "masked": "hf-****ab12",
  "keyPrefix": "hf-",
  "keyLastFour": "ab12",
  "isActive": true,
  "baseUrl": null,
  "lastTestedAt": "2026-05-27T12:00:00.000Z",
  "lastTestResult": "valid",
  "createdAt": "2026-05-27T10:00:00.000Z",
  "updatedAt": "2026-05-27T12:00:00.000Z"
}
```

### 5.4 Higgsfield API Key (env)

```json
{
  "id": null,
  "providerType": "higgsfield",
  "providerName": "Higgsfield AI",
  "label": "Variable d'environnement",
  "source": "env",
  "masked": "hf-****cd34",
  "keyPrefix": "hf-",
  "keyLastFour": "cd34",
  "isActive": true,
  "baseUrl": null,
  "lastTestedAt": null,
  "lastTestResult": null,
  "createdAt": null,
  "updatedAt": null
}
```

### 5.5 Higgsfield API Key (none)

```json
{
  "id": null,
  "providerType": "higgsfield",
  "providerName": "Higgsfield AI",
  "label": "Non configure",
  "source": "none",
  "masked": "",
  "keyPrefix": "",
  "keyLastFour": "",
  "isActive": false,
  "baseUrl": null,
  "lastTestedAt": null,
  "lastTestResult": null,
  "createdAt": null,
  "updatedAt": null
}
```

### 5.6 Higgsfield API Key Test Result (valid)

```json
{
  "result": {
    "valid": true,
    "provider": "higgsfield",
    "latencyMs": 95
  }
}
```

### 5.7 Higgsfield API Key Test Result (invalid)

```json
{
  "result": {
    "valid": false,
    "provider": "higgsfield",
    "latencyMs": 200,
    "error": "Invalid Higgsfield API key"
  }
}
```

### 5.8 Higgsfield API Key Creation Response

```json
{
  "apiKey": {
    "id": "ak-hf-new",
    "providerType": "higgsfield",
    "providerName": "Higgsfield AI",
    "label": "New key",
    "source": "database",
    "masked": "hf-****new1",
    "keyPrefix": "hf-",
    "keyLastFour": "new1",
    "isActive": true,
    "baseUrl": null,
    "lastTestedAt": null,
    "lastTestResult": null,
    "createdAt": "2026-05-27T14:00:00.000Z",
    "updatedAt": "2026-05-27T14:00:00.000Z"
  }
}
```

---

## 6. Exports

Add these to the module exports at the bottom of `ai-engine-handlers.ts`:

```typescript
export {
  // ... existing exports ...
  MOCK_HIGGSFIELD_KEY_ENV,
  MOCK_HIGGSFIELD_KEY_NONE,
};
```

The `MOCK_PROVIDERS`, `MOCK_API_KEYS`, and `MOCK_MODEL_DISCOVERY` exports
already exist and will include Higgsfield data after the additions above.

---

## 7. Usage Example in Tests

```typescript
import {
  aiEngineHandlers,
  apiKeysHandlers,
  modelDiscoveryHandlers,
  apiKeysErrorHandlers,
  modelDiscoveryErrorHandlers,
  MOCK_PROVIDERS,
  MOCK_API_KEYS,
  MOCK_MODEL_DISCOVERY,
} from '@/test/msw/ai-engine-handlers';
import { setupServer } from 'msw/node';

const server = setupServer(
  ...aiEngineHandlers,
  ...apiKeysHandlers,
  ...modelDiscoveryHandlers,
);

// For a specific error scenario:
server.use(apiKeysErrorHandlers.testHiggsfield401);

// Verify Higgsfield data is present:
expect(MOCK_PROVIDERS.find(p => p.providerType === 'higgsfield')).toBeDefined();
expect(MOCK_MODEL_DISCOVERY['higgsfield']).toBeDefined();
expect(MOCK_API_KEYS.find(k => k.providerType === 'higgsfield')).toBeDefined();
```
