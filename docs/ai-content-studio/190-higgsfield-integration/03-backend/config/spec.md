# Configuration Changes Specification

**Document:** 190-HF/03-backend/config/spec.md
**Date:** 2026-05-27
**Scope:** All configuration file changes required to register Higgsfield AI as a provider
**Impact:** 6 existing files modified, 0 new files

---

## 1. `src/lib/env.ts` -- Environment Variables

### 1.1 Add API Key Variable

**Location:** Line 137, after `AI_ENGINE_ELEVENLABS_API_KEY`

**Current code:**
```typescript
AI_ENGINE_ELEVENLABS_API_KEY: z.string().optional(),
AI_ENGINE_OLLAMA_BASE_URL: z.string().url().optional(),
```

**New code:**
```typescript
AI_ENGINE_ELEVENLABS_API_KEY: z.string().optional(),
AI_ENGINE_HIGGSFIELD_API_KEY: z.string().optional(),
AI_ENGINE_OLLAMA_BASE_URL: z.string().url().optional(),
```

**Rationale:** Follows the alphabetical provider ordering pattern. The key is optional because Higgsfield is not a required provider.

### 1.2 Add Higgsfield to Image Provider Enum

**Location:** Line 141

**Current code:**
```typescript
AI_ENGINE_DEFAULT_IMAGE_PROVIDER: z.enum(['openai', 'google', 'stability', 'mock']).default('mock'),
```

**New code:**
```typescript
AI_ENGINE_DEFAULT_IMAGE_PROVIDER: z.enum(['openai', 'google', 'stability', 'higgsfield', 'mock']).default('mock'),
```

**Rationale:** Allows `AI_ENGINE_DEFAULT_IMAGE_PROVIDER=higgsfield` in `.env`.

### 1.3 Add Higgsfield to Video Provider Enum

**Location:** Line 143

**Current code:**
```typescript
AI_ENGINE_DEFAULT_VIDEO_PROVIDER: z.enum(['google', 'runway', 'mock']).default('mock'),
```

**New code:**
```typescript
AI_ENGINE_DEFAULT_VIDEO_PROVIDER: z.enum(['google', 'runway', 'higgsfield', 'mock']).default('mock'),
```

### 1.4 Add to parse() Block

**Location:** Line 237 area, after `AI_ENGINE_ELEVENLABS_API_KEY`

**Current code:**
```typescript
AI_ENGINE_ELEVENLABS_API_KEY: process.env.AI_ENGINE_ELEVENLABS_API_KEY,
AI_ENGINE_OLLAMA_BASE_URL: process.env.AI_ENGINE_OLLAMA_BASE_URL,
```

**New code:**
```typescript
AI_ENGINE_ELEVENLABS_API_KEY: process.env.AI_ENGINE_ELEVENLABS_API_KEY,
AI_ENGINE_HIGGSFIELD_API_KEY: process.env.AI_ENGINE_HIGGSFIELD_API_KEY,
AI_ENGINE_OLLAMA_BASE_URL: process.env.AI_ENGINE_OLLAMA_BASE_URL,
```

### 1.5 .env.example Update

Add to `apps/web/.env.example`:
```
# Higgsfield AI (image + video generation)
AI_ENGINE_HIGGSFIELD_API_KEY=
```

---

## 2. `src/lib/ai-engine/config/engine-config.ts` -- Engine Config

### 2.1 Add Higgsfield to Image Provider Union

**Location:** Line 12

**Current code:**
```typescript
image: {
  default: 'openai' | 'google' | 'stability' | 'mock';
  model: string;
};
```

**New code:**
```typescript
image: {
  default: 'openai' | 'google' | 'stability' | 'higgsfield' | 'mock';
  model: string;
};
```

### 2.2 Add Higgsfield to Video Provider Union

**Location:** Line 16

**Current code:**
```typescript
video: {
  default: 'google' | 'runway' | 'mock';
};
```

**New code:**
```typescript
video: {
  default: 'google' | 'runway' | 'higgsfield' | 'mock';
};
```

### 2.3 Add Higgsfield to apiKeys

**Location:** Line 23-29

**Current code:**
```typescript
apiKeys: {
  openai: string | undefined;
  anthropic: string | undefined;
  google: string | undefined;
  elevenlabs: string | undefined;
  ollamaBaseUrl: string | undefined;
};
```

**New code:**
```typescript
apiKeys: {
  openai: string | undefined;
  anthropic: string | undefined;
  google: string | undefined;
  elevenlabs: string | undefined;
  higgsfield: string | undefined;
  ollamaBaseUrl: string | undefined;
};
```

### 2.4 Add Higgsfield Key Resolution in getEngineConfig()

**Location:** Line 74-78 (inside `apiKeys` block of `getEngineConfig()`)

**Current code:**
```typescript
apiKeys: {
  openai: env.AI_ENGINE_OPENAI_API_KEY || env.CONTENT_STUDIO_OPENAI_API_KEY || env.CHAT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || undefined,
  anthropic: env.AI_ENGINE_ANTHROPIC_API_KEY || env.CHAT_ANTHROPIC_API_KEY || undefined,
  google: env.AI_ENGINE_GOOGLE_API_KEY || env.CHAT_GEMINI_API_KEY || undefined,
  elevenlabs: env.AI_ENGINE_ELEVENLABS_API_KEY || undefined,
  ollamaBaseUrl: env.AI_ENGINE_OLLAMA_BASE_URL || env.CHAT_OLLAMA_BASE_URL || undefined,
},
```

**New code:**
```typescript
apiKeys: {
  openai: env.AI_ENGINE_OPENAI_API_KEY || env.CONTENT_STUDIO_OPENAI_API_KEY || env.CHAT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || undefined,
  anthropic: env.AI_ENGINE_ANTHROPIC_API_KEY || env.CHAT_ANTHROPIC_API_KEY || undefined,
  google: env.AI_ENGINE_GOOGLE_API_KEY || env.CHAT_GEMINI_API_KEY || undefined,
  elevenlabs: env.AI_ENGINE_ELEVENLABS_API_KEY || undefined,
  higgsfield: env.AI_ENGINE_HIGGSFIELD_API_KEY || undefined,
  ollamaBaseUrl: env.AI_ENGINE_OLLAMA_BASE_URL || env.CHAT_OLLAMA_BASE_URL || undefined,
},
```

**Rationale:** Higgsfield has a single env var (no legacy fallback chain like OpenAI has). If a secondary env var convention emerges later, it can be added to the chain.

---

## 3. `src/lib/ai-engine/providers/types.ts` -- Type System

### 3.1 Add to ProviderType Enum

**Location:** Lines 19-27

**Current code:**
```typescript
export const ProviderType = z.enum([
  'openai',
  'anthropic',
  'google',
  'ollama',
  'elevenlabs',
  'runway',
  'stability',
]);
```

**New code:**
```typescript
export const ProviderType = z.enum([
  'openai',
  'anthropic',
  'google',
  'ollama',
  'elevenlabs',
  'runway',
  'stability',
  'higgsfield',
]);
```

**Rationale:** This single change propagates via `z.infer<typeof ProviderType>` to every TypeScript usage. The Zod enum validates incoming API requests, DB queries, and config parsing.

**Impact chain:**
- `ProviderConfig.type` accepts `'higgsfield'`
- `ProviderSelector.createAdapter()` can switch on `'higgsfield'`
- DB column `ai_engine_provider_config.providerType` accepts `'higgsfield'` (text column, no migration needed)
- API routes accepting `providerType` in request bodies validate `'higgsfield'`

---

## 4. `src/lib/ai-engine/providers/selector.ts` -- Provider Selector

### 4.1 Import HiggsFieldAdapter

**Location:** Line 5, after existing imports

**Current code:**
```typescript
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { GoogleAdapter } from './adapters/google';
import { globalCostTracker } from './cost-tracker';
```

**New code:**
```typescript
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { GoogleAdapter } from './adapters/google';
import { HiggsFieldAdapter } from './adapters/higgsfield';
import { globalCostTracker } from './cost-tracker';
```

### 4.2 Add Case to createAdapter()

**Location:** Lines 9-20

**Current code:**
```typescript
function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.type) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'google':
      return new GoogleAdapter(config);
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}
```

**New code:**
```typescript
function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.type) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'google':
      return new GoogleAdapter(config);
    case 'higgsfield':
      return new HiggsFieldAdapter(config);
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}
```

**Rationale:** This is the factory function that maps provider type strings to adapter instances. The `ProviderSelector.selectProvider()` method uses it to lazily create adapters. Without this case, any config with `type: 'higgsfield'` would throw at runtime.

---

## 5. `src/app/api/admin/ai-engine/config/providers/route.ts` -- Provider Registration

### 5.1 Add Higgsfield to getDefaultProviders()

**Location:** After the Ollama entry (line ~149), before the closing `]`

**New entry:**
```typescript
{
  id: 'default-higgsfield',
  providerType: 'higgsfield',
  name: 'Higgsfield AI',
  apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
  baseUrl: null,
  capabilities: ['image', 'video'],
  models: [
    { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
    { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
  ],
  rateLimitRpm: 60,
  dailyBudgetCents: Math.round(config.budget.dailyCents * 0.2),
  circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
  priority: 15,
  isFallback: false,
  isEnabled: true,
  healthStatus: 'healthy',
  lastHealthCheck: now,
  configured: !!config.apiKeys.higgsfield,
},
```

**Design decisions:**
- **Priority 15:** Between OpenAI (10) and Anthropic (20). Higgsfield is the preferred image/video provider, but OpenAI remains the overall primary for text.
- **isFallback: false:** Higgsfield is the primary provider for image/video. OpenAI/Google serve as fallbacks.
- **dailyBudgetCents: 20%:** Reasonable share for a specialized image/video provider. The rest goes to OpenAI (50%), Anthropic (30%), etc.
- **rateLimitRpm: 60:** Conservative default; adjust based on actual Higgsfield plan limits.
- **costPerUnit:** 500 cents ($5.00) per image, 2000 cents ($20.00) per video. These are placeholder values.

### 5.2 Add to envKeyMap in GET Handler

**Location:** Lines 168-175

**Current code:**
```typescript
const envKeyMap: Record<string, string | undefined> = {
  AI_ENGINE_OPENAI_API_KEY: config.apiKeys.openai,
  AI_ENGINE_ANTHROPIC_API_KEY: config.apiKeys.anthropic,
  AI_ENGINE_GOOGLE_API_KEY: config.apiKeys.google,
  AI_ENGINE_ELEVENLABS_API_KEY: config.apiKeys.elevenlabs,
  AI_ENGINE_OLLAMA_BASE_URL: config.apiKeys.ollamaBaseUrl,
  OLLAMA_PROVIDER_KEY: config.apiKeys.ollamaBaseUrl || process.env.OLLAMA_PROVIDER_KEY,
};
```

**New code:**
```typescript
const envKeyMap: Record<string, string | undefined> = {
  AI_ENGINE_OPENAI_API_KEY: config.apiKeys.openai,
  AI_ENGINE_ANTHROPIC_API_KEY: config.apiKeys.anthropic,
  AI_ENGINE_GOOGLE_API_KEY: config.apiKeys.google,
  AI_ENGINE_ELEVENLABS_API_KEY: config.apiKeys.elevenlabs,
  AI_ENGINE_HIGGSFIELD_API_KEY: config.apiKeys.higgsfield,
  AI_ENGINE_OLLAMA_BASE_URL: config.apiKeys.ollamaBaseUrl,
  OLLAMA_PROVIDER_KEY: config.apiKeys.ollamaBaseUrl || process.env.OLLAMA_PROVIDER_KEY,
};
```

**Rationale:** The `envKeyMap` is used to set `configured: boolean` on each provider. Without this entry, DB-stored Higgsfield configs using `apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY'` would always show `configured: false`.

---

## 6. `src/app/api/admin/ai-engine/config/providers/models/route.ts` -- Models API

### 6.1 Add to VALID_PROVIDERS

**Location:** Lines 18-26

**Current code:**
```typescript
const VALID_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'elevenlabs',
  'ollama',
  'runway',
  'stability',
] as const);
```

**New code:**
```typescript
const VALID_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'elevenlabs',
  'ollama',
  'runway',
  'stability',
  'higgsfield',
] as const);
```

### 6.2 Add to STATIC_FALLBACKS

**Location:** After `STABILITY_MODELS` (line ~66)

**New code:**
```typescript
const HIGGSFIELD_MODELS: ModelEntry[] = [
  { id: 'higgsfield-diffusion-v2', role: 'image' },
  { id: 'higgsfield-xl-v1', role: 'image' },
  { id: 'higgsfield-video-v1', role: 'video' as ModelEntry['role'] },
];

// Update STATIC_FALLBACKS:
const STATIC_FALLBACKS: Record<string, ModelEntry[]> = {
  elevenlabs: ELEVENLABS_MODELS,
  runway: RUNWAY_MODELS,
  stability: STABILITY_MODELS,
  higgsfield: HIGGSFIELD_MODELS,
};
```

**Note:** The `role: 'video'` requires extending the `ModelEntry.role` union type in `model-discovery.ts`. See services/spec.md section 3.2. If Higgsfield provides a model-listing API, we can add it to `PROVIDER_TO_DISCOVERY` instead and use live discovery. For now, static fallback is the safe default.

### 6.3 Add to POPULAR_MODELS

**Location:** After the `ollama` entry (line ~97)

**New code:**
```typescript
higgsfield: [
  'higgsfield-diffusion-v2',
  'higgsfield-xl-v1',
  'higgsfield-video-v1',
],
```

### 6.4 Optional: Add to PROVIDER_TO_DISCOVERY

If Higgsfield exposes a model-listing API (e.g., `GET /v1/models`), add:

```typescript
const PROVIDER_TO_DISCOVERY: Partial<Record<string, DiscoverableProvider>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'gemini',
  ollama: 'ollama',
  higgsfield: 'higgsfield',  // only if live discovery is supported
};
```

If not, Higgsfield falls through to `STATIC_FALLBACKS` in the GET handler and live discovery is skipped. This is the same pattern used for `runway` and `stability`.

---

## 7. Summary of All Changes

| File | Lines Changed | Type |
|------|--------------|------|
| `src/lib/env.ts` | +3 lines (schema) + 1 line (parse) | Schema + parse block |
| `src/lib/ai-engine/config/engine-config.ts` | +3 lines (types) + 1 line (apiKeys) | Interface + config |
| `src/lib/ai-engine/providers/types.ts` | +1 line | Zod enum entry |
| `src/lib/ai-engine/providers/selector.ts` | +2 lines (import + case) | Factory function |
| `src/app/api/admin/ai-engine/config/providers/route.ts` | +22 lines (default provider) + 1 line (envKeyMap) | API route |
| `src/app/api/admin/ai-engine/config/providers/models/route.ts` | +12 lines (models + fallback + popular) | API route |
| `apps/web/.env.example` | +2 lines | Example env |

**Total: ~48 lines added across 7 files. No lines deleted. No breaking changes.**

---

## 8. Verification Checklist

After applying all configuration changes, verify:

- [ ] `env.ts` Zod schema parses without error when `AI_ENGINE_HIGGSFIELD_API_KEY` is absent
- [ ] `env.ts` Zod schema parses without error when `AI_ENGINE_DEFAULT_IMAGE_PROVIDER=higgsfield`
- [ ] `env.ts` Zod schema parses without error when `AI_ENGINE_DEFAULT_VIDEO_PROVIDER=higgsfield`
- [ ] `getEngineConfig()` populates `apiKeys.higgsfield` from env
- [ ] `ProviderType.parse('higgsfield')` succeeds
- [ ] `ProviderType.parse('invalid')` still fails
- [ ] `createAdapter({ type: 'higgsfield', ... })` returns `HiggsFieldAdapter`
- [ ] `GET /api/admin/ai-engine/config/providers` includes Higgsfield in response
- [ ] `GET /api/admin/ai-engine/config/providers/models?provider=higgsfield` returns model list
- [ ] `GET /api/admin/ai-engine/config/providers/models?provider=higgsfield&capability=image` filters to image models only
- [ ] TypeScript compilation passes with zero errors
- [ ] Existing tests continue to pass (no regressions)
