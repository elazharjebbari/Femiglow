# Service Layer Changes Specification

**Document:** 190-HF/03-backend/services/spec.md
**Date:** 2026-05-27
**Scope:** Changes to api-key-manager.ts, api-key-validator.ts, model-discovery.ts
**Impact:** 3 existing files modified

---

## 1. `src/lib/ai-engine/services/api-key-manager.ts`

### 1.1 Add to PROVIDER_NAMES

**Location:** Lines 32-38

**Current code:**
```typescript
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI (Gemini)',
  elevenlabs: 'ElevenLabs',
  ollama: 'Ollama (local)',
};
```

**New code:**
```typescript
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI (Gemini)',
  elevenlabs: 'ElevenLabs',
  higgsfield: 'Higgsfield AI',
  ollama: 'Ollama (local)',
};
```

**Rationale:** `PROVIDER_NAMES` is used throughout the manager to provide human-readable provider names in API responses (`listApiKeys()`, `saveApiKey()` default labels), UI display, and log messages. Without this entry, Higgsfield keys would fall through to `PROVIDER_NAMES[provider] ?? provider` which returns the raw string `'higgsfield'` -- functional but inconsistent with the display name pattern.

### 1.2 Add to ENV_KEY_MAP

**Location:** Lines 40-46

**Current code:**
```typescript
const ENV_KEY_MAP: Record<string, string[]> = {
  openai: ['AI_ENGINE_OPENAI_API_KEY', 'CONTENT_STUDIO_OPENAI_API_KEY', 'CHAT_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  anthropic: ['AI_ENGINE_ANTHROPIC_API_KEY', 'CHAT_ANTHROPIC_API_KEY'],
  google: ['GOOGLE_AI_PROVIDER_KEY', 'AI_ENGINE_GOOGLE_API_KEY', 'CHAT_GEMINI_API_KEY'],
  elevenlabs: ['AI_ENGINE_ELEVENLABS_API_KEY'],
  ollama: ['OLLAMA_PROVIDER_KEY', 'AI_ENGINE_OLLAMA_API_KEY', 'AI_ENGINE_OLLAMA_BASE_URL', 'CHAT_OLLAMA_BASE_URL'],
};
```

**New code:**
```typescript
const ENV_KEY_MAP: Record<string, string[]> = {
  openai: ['AI_ENGINE_OPENAI_API_KEY', 'CONTENT_STUDIO_OPENAI_API_KEY', 'CHAT_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  anthropic: ['AI_ENGINE_ANTHROPIC_API_KEY', 'CHAT_ANTHROPIC_API_KEY'],
  google: ['GOOGLE_AI_PROVIDER_KEY', 'AI_ENGINE_GOOGLE_API_KEY', 'CHAT_GEMINI_API_KEY'],
  elevenlabs: ['AI_ENGINE_ELEVENLABS_API_KEY'],
  higgsfield: ['AI_ENGINE_HIGGSFIELD_API_KEY'],
  ollama: ['OLLAMA_PROVIDER_KEY', 'AI_ENGINE_OLLAMA_API_KEY', 'AI_ENGINE_OLLAMA_BASE_URL', 'CHAT_OLLAMA_BASE_URL'],
};
```

**Rationale:** `ENV_KEY_MAP` defines the fallback chain for `resolveEnvKey()`. When no DB key exists, the manager tries each env var in order. Higgsfield currently has a single canonical env var. If additional env var names are introduced later (e.g., `HIGGSFIELD_API_KEY`), they can be appended to the array.

### 1.3 Add to Providers List

**Location:** Line 60 (inside `listApiKeys()`)

**Current code:**
```typescript
const providers = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'];
```

**New code:**
```typescript
const providers = ['openai', 'anthropic', 'google', 'elevenlabs', 'higgsfield', 'ollama'];
```

**Rationale:** This array drives the `listApiKeys()` loop. For each provider, the function checks for a DB key first, then env fallback, then reports `'Non configure'`. Adding `'higgsfield'` ensures the API key listing page shows Higgsfield in the list regardless of whether a key is stored.

### 1.4 Error Handling

No new error handling needed. The existing patterns in `resolveApiKey()`, `saveApiKey()`, `deleteApiKey()`, and `testApiKey()` are all provider-agnostic -- they work on `providerType: string`. Adding `'higgsfield'` to the maps above is sufficient.

---

## 2. `src/lib/ai-engine/services/api-key-validator.ts`

### 2.1 Add Case in validateApiKey()

**Location:** Lines 22-35 (inside the switch statement)

**Current code:**
```typescript
switch (providerType) {
  case 'openai':
    return await testOpenAI(apiKey, start);
  case 'anthropic':
    return await testAnthropic(apiKey, start);
  case 'google':
    return await testGoogle(apiKey, start);
  case 'elevenlabs':
    return await testElevenLabs(apiKey, start);
  case 'ollama':
    return await testOllama(apiKey, baseUrl ?? 'http://localhost:11434', start);
  default:
    return { valid: false, provider: providerType, latencyMs: Date.now() - start, error: `Unknown provider: ${providerType}` };
}
```

**New code:**
```typescript
switch (providerType) {
  case 'openai':
    return await testOpenAI(apiKey, start);
  case 'anthropic':
    return await testAnthropic(apiKey, start);
  case 'google':
    return await testGoogle(apiKey, start);
  case 'elevenlabs':
    return await testElevenLabs(apiKey, start);
  case 'higgsfield':
    return await testHiggsfield(apiKey, start);
  case 'ollama':
    return await testOllama(apiKey, baseUrl ?? 'http://localhost:11434', start);
  default:
    return { valid: false, provider: providerType, latencyMs: Date.now() - start, error: `Unknown provider: ${providerType}` };
}
```

### 2.2 Implement testHiggsfield()

**Location:** After `testElevenLabs()` (line 86), before `testOllama()`

**New code:**
```typescript
async function testHiggsfield(apiKey: string, start: number): Promise<ValidationResult> {
  // Strategy: Hit a lightweight endpoint that requires authentication.
  // Options (in order of preference):
  //   1. GET /v1/models — lists available models (low cost, proves auth)
  //   2. GET /v1/account — returns account info
  //   3. GET /v1/health — may not require auth (less useful)
  //
  // We attempt /v1/models first. If Higgsfield does not expose a model-listing
  // endpoint, fall back to /v1/account or a minimal image generation request.

  const res = await fetch('https://api.higgsfield.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.ok) {
    return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  }

  // 401 = definitively invalid key
  if (res.status === 401) {
    return {
      valid: false,
      provider: 'higgsfield',
      latencyMs: Date.now() - start,
      error: 'Invalid API key',
    };
  }

  // 400/429 = key is valid but request was rejected for other reasons
  // (rate limit, bad request format). Same logic as testAnthropic().
  if (res.status === 400 || res.status === 429) {
    return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  }

  // Anything else (403, 5xx) = inconclusive but report as failure
  const body = await res.text().catch(() => '');
  return {
    valid: false,
    provider: 'higgsfield',
    latencyMs: Date.now() - start,
    error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
  };
}
```

**Design decisions:**

1. **Endpoint choice:** `GET /v1/models` is preferred because:
   - It is a read-only, low-cost operation
   - It requires authentication (proves the key works)
   - It does not trigger billing (unlike generating an image)
   - The same pattern is used for OpenAI validation (`/v1/models`)

2. **HTTP 400/429 = valid:** Follows the Anthropic pattern. If the server rejects the request for non-auth reasons, the key itself is valid.

3. **Timeout:** Uses the existing `TIMEOUT_MS = 10_000` constant shared by all validators.

4. **Fallback endpoint:** If `/v1/models` returns 404 (not a valid endpoint), this should be changed to `/v1/account` or whichever health/identity endpoint Higgsfield provides. This is an open question from the audit.

---

## 3. `src/lib/ai-engine/services/model-discovery.ts`

### 3.1 Add to DiscoverableProvider

**Location:** Lines 23-32

**Current code:**
```typescript
export type DiscoverableProvider =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'azure-openai'
  | 'ollama';
```

**New code:**
```typescript
export type DiscoverableProvider =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'azure-openai'
  | 'ollama'
  | 'higgsfield';
```

### 3.2 Extend ModelEntry Role Union

**Location:** Lines 34-37

**Current code:**
```typescript
export interface ModelEntry {
  id: string;
  role: 'chat' | 'embedding' | 'vision' | 'image' | 'tts' | 'code';
}
```

**New code:**
```typescript
export interface ModelEntry {
  id: string;
  role: 'chat' | 'embedding' | 'vision' | 'image' | 'tts' | 'code' | 'video';
}
```

**Rationale:** The existing `role` union does not include `'video'`. Higgsfield's video models need a role to enable capability-based filtering in the models endpoint (`GET /api/admin/ai-engine/config/providers/models?capability=video`). This also benefits Google's video models (Veo, etc.) which are currently unlisted.

### 3.3 Add to FALLBACK_MODELS

**Location:** After the `ollama` entry (line ~114)

**New code:**
```typescript
higgsfield: [
  { id: 'higgsfield-diffusion-v2', role: 'image' },
  { id: 'higgsfield-xl-v1', role: 'image' },
  { id: 'higgsfield-video-v1', role: 'video' },
],
```

### 3.4 Implement fetchHiggsfield()

**Location:** After `fetchOllama()` (line ~265)

**New code:**
```typescript
/**
 * Fetch models from the Higgsfield API.
 *
 * Falls back to null if the endpoint does not exist or requires
 * a different authentication mechanism, in which case
 * FALLBACK_MODELS['higgsfield'] is used by the orchestrator.
 */
export async function fetchHiggsfield(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.higgsfield.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`higgsfield ${res.status}`);

  const json = (await res.json()) as {
    models?: Array<{ id: string; type?: string; capability?: string }>;
  };

  return (json.models ?? []).map((m) => {
    let role: ModelEntry['role'] = 'image';
    // Infer role from model metadata or naming convention
    if (m.type === 'video' || m.capability === 'video' || /video/i.test(m.id)) {
      role = 'video';
    } else if (/embed/i.test(m.id)) {
      role = 'embedding';
    }
    return { id: m.id, role };
  });
}
```

**Design decisions:**

1. **Response format assumption:** We assume `{ models: [{ id, type? }] }`. The `type` or `capability` field is used for role inference. If the actual API response differs, the mapping function should be adjusted.

2. **Role inference:** Uses a three-tier approach:
   - Explicit metadata (`m.type` or `m.capability`)
   - Naming convention regex (`/video/`, `/embed/`)
   - Default to `'image'` (since Higgsfield is primarily an image/video provider)

3. **Error handling:** Throws on non-200, which causes the `discoverModels()` orchestrator to fall back to `FALLBACK_MODELS['higgsfield']`.

### 3.5 Add to callFetcher()

**Location:** Lines 271-301 (inside the switch statement)

**Current code (relevant section):**
```typescript
async function callFetcher(
  provider: DiscoverableProvider,
  opts: { apiKey?: string; apiBase?: string; authToken?: string },
): Promise<ModelEntry[] | null> {
  switch (provider) {
    case 'openai':
      if (!opts.apiKey) return null;
      return fetchOpenAI(opts.apiKey, opts.apiBase);
    case 'anthropic':
      if (!opts.apiKey) return null;
      return fetchAnthropic(opts.apiKey);
    // ... other cases ...
    case 'ollama':
      return fetchOllama(opts.apiBase ?? 'http://localhost:11434', opts.authToken);
    case 'qwen':
    case 'zhipu':
    case 'azure-openai':
      return null;
    default:
      return null;
  }
}
```

**New code (add before the default case):**
```typescript
    case 'higgsfield':
      if (!opts.apiKey) return null;
      return fetchHiggsfield(opts.apiKey);
```

**Full switch with the new case:**
```typescript
    case 'ollama':
      return fetchOllama(opts.apiBase ?? 'http://localhost:11434', opts.authToken);
    case 'higgsfield':
      if (!opts.apiKey) return null;
      return fetchHiggsfield(opts.apiKey);
    // qwen / zhipu / azure-openai: non-uniform APIs -- static fallback only
    case 'qwen':
    case 'zhipu':
    case 'azure-openai':
      return null;
    default:
      return null;
```

### 3.6 Update CAPABILITY_TO_ROLE in models/route.ts

**Location:** `src/app/api/admin/ai-engine/config/providers/models/route.ts` lines 104-112

**Current code:**
```typescript
const CAPABILITY_TO_ROLE: Record<string, ModelEntry['role']> = {
  text: 'chat',
  chat: 'chat',
  embedding: 'embedding',
  image: 'image',
  tts: 'tts',
  vision: 'vision',
  code: 'code',
};
```

**New code:**
```typescript
const CAPABILITY_TO_ROLE: Record<string, ModelEntry['role']> = {
  text: 'chat',
  chat: 'chat',
  embedding: 'embedding',
  image: 'image',
  video: 'video',
  tts: 'tts',
  vision: 'vision',
  code: 'code',
};
```

**Rationale:** Without `video: 'video'`, the query `?capability=video` would not filter correctly. The `video` role was not needed before because no provider exposed video-specific models through the discovery system.

---

## 4. Integration Flow

After all three service files are updated, the following flows work end-to-end:

### 4.1 API Key Management Flow

```
Admin UI: "Add Higgsfield API Key"
  → POST /api/admin/ai-engine/config/api-keys
    → saveApiKey('higgsfield', 'hf-key-xxx')
      → PROVIDER_NAMES['higgsfield'] → 'Higgsfield AI' (label)
      → encrypt + store in DB
  → Response: { providerName: 'Higgsfield AI', source: 'database', ... }

Admin UI: "Test Key"
  → POST /api/admin/ai-engine/config/api-keys/:id/test
    → testApiKey('higgsfield')
      → resolveApiKey('higgsfield')
        → check DB first
        → fallback: ENV_KEY_MAP['higgsfield'] → 'AI_ENGINE_HIGGSFIELD_API_KEY'
      → validateApiKey('higgsfield', key)
        → testHiggsfield(key, start)
          → GET https://api.higgsfield.ai/v1/models
      → Response: { valid: true, latencyMs: 450 }

Admin UI: "List Keys"
  → GET /api/admin/ai-engine/config/api-keys
    → listApiKeys()
      → providers includes 'higgsfield'
      → checks DB, then env, then 'Non configure'
      → Response includes Higgsfield entry
```

### 4.2 Model Discovery Flow

```
Admin UI: ModelSelector component for Higgsfield
  → GET /api/admin/ai-engine/config/providers/models?provider=higgsfield
    → VALID_PROVIDERS.has('higgsfield') ✓
    → STATIC_FALLBACKS['higgsfield'] → HIGGSFIELD_MODELS
      → (or) PROVIDER_TO_DISCOVERY['higgsfield'] → discoverModels('higgsfield', { apiKey })
        → callFetcher('higgsfield', ...) → fetchHiggsfield(apiKey)
        → merge with FALLBACK_MODELS['higgsfield']
    → filter by ?capability if present
    → sort by POPULAR_MODELS['higgsfield']
    → Response: { models: [...], source: 'fallback' | 'live' }
```

### 4.3 Key Resolution Chain

```
resolveApiKey('higgsfield')
  1. Check in-memory cache (5min TTL)
     → hit: return cached key
  2. Query DB: ai_engine_api_keys WHERE providerType='higgsfield' AND isActive=true
     → found: decrypt, cache, return
  3. Check env: ENV_KEY_MAP['higgsfield']
     → tries: AI_ENGINE_HIGGSFIELD_API_KEY
     → found: cache, return
  4. Return undefined (no key configured)
```

---

## 5. Error Handling Summary

| Service | Error Case | Behavior |
|---------|-----------|----------|
| api-key-manager | DB unavailable | Falls back to env-only resolution |
| api-key-manager | Decryption fails | Logs error, falls through to env |
| api-key-manager | No key found | Returns `undefined` (caller handles) |
| api-key-validator | Network error | Caught by outer try/catch, returns `{ valid: false, error }` |
| api-key-validator | Timeout (10s) | AbortSignal fires, caught as error |
| api-key-validator | HTTP 401 | Returns `{ valid: false, error: 'Invalid API key' }` |
| api-key-validator | HTTP 429 | Returns `{ valid: true }` (key valid, rate limited) |
| api-key-validator | HTTP 5xx | Returns `{ valid: false, error }` |
| model-discovery | Fetch error | Falls back to FALLBACK_MODELS['higgsfield'] |
| model-discovery | No API key | Returns null from callFetcher, uses fallback |
| model-discovery | Timeout (5s) | fetchWithTimeout aborts, uses fallback |

---

## 6. Caching Behavior

| Cache | Location | TTL | Key | Invalidation |
|-------|----------|-----|-----|-------------|
| Resolved API keys | api-key-manager.ts `resolvedKeyCache` | 5 min | `providerType` | `invalidateCache('higgsfield')` on save/delete |
| Model lists | model-discovery.ts `modelCache` | 5 min | `'higgsfield'` | `invalidateModelCache('higgsfield')` |

Both caches are in-memory `Map` instances. They reset on server restart and do not require explicit warming for Higgsfield.
