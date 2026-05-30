# Plan d'Action Global - Integration Higgsfield AI

**Date:** 2026-05-27
**Auteur:** AI Engine Team
**Status:** Ready for execution
**Effort total estime:** 7-9 heures (1-2 jours calendaires)
**Branch:** `feat/higgsfield-provider`

---

## Vue d'ensemble

Integration de Higgsfield AI comme provider d'image et video dans l'AI Engine FemiGlow.
L'architecture existante est provider-agnostic (adapter pattern + ProviderSelector).
Higgsfield sera le provider primaire pour image/video (priority 15), devant OpenAI (10 pour text, pas d'image priority) et Google (30).

**10 fichiers modifies + 1 fichier cree = 11 fichiers au total.**

---

## Phase 1 : Type System & Configuration (30 min)

### Objectif
Declarer le type `'higgsfield'` dans le systeme de types et les enums de configuration.

### Prerequis
- Branch `feat/higgsfield-provider` creee depuis `feat/ai-engine-langgraph-mvp`
- Build propre sur la branche source

### Fichier 1.1 : `src/lib/ai-engine/providers/types.ts`

**Changement :** Ajouter `'higgsfield'` au z.enum `ProviderType` (ligne 19-27).

**Avant :**
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

**Apres :**
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

**Impact :** Tous les `ProviderConfig` et `ProviderType` acceptent maintenant `'higgsfield'`. La validation Zod + TypeScript sont coherents.

### Fichier 1.2 : `src/lib/env.ts`

**Changement 1 :** Ajouter la variable d'environnement `AI_ENGINE_HIGGSFIELD_API_KEY` au schema Zod (apres `AI_ENGINE_OLLAMA_BASE_URL`).

**Ajouter :**
```typescript
AI_ENGINE_HIGGSFIELD_API_KEY: z.string().optional(),
```

**Changement 2 :** Ajouter `'higgsfield'` aux enums des providers par defaut.

**Avant :**
```typescript
AI_ENGINE_DEFAULT_IMAGE_PROVIDER: z.enum(['openai', 'google', 'stability', 'mock']).default('mock'),
AI_ENGINE_DEFAULT_VIDEO_PROVIDER: z.enum(['google', 'runway', 'mock']).default('mock'),
```

**Apres :**
```typescript
AI_ENGINE_DEFAULT_IMAGE_PROVIDER: z.enum(['openai', 'google', 'stability', 'higgsfield', 'mock']).default('mock'),
AI_ENGINE_DEFAULT_VIDEO_PROVIDER: z.enum(['google', 'runway', 'higgsfield', 'mock']).default('mock'),
```

**Changement 3 :** Ajouter au bloc `parse()` (apres `AI_ENGINE_OLLAMA_BASE_URL`).

**Ajouter :**
```typescript
AI_ENGINE_HIGGSFIELD_API_KEY: process.env.AI_ENGINE_HIGGSFIELD_API_KEY,
```

### Fichier 1.3 : `src/lib/ai-engine/config/engine-config.ts`

**Changement 1 :** Ajouter `'higgsfield'` aux types de provider image et video.

**Avant :**
```typescript
image: {
  default: 'openai' | 'google' | 'stability' | 'mock';
  model: string;
};
video: {
  default: 'google' | 'runway' | 'mock';
};
```

**Apres :**
```typescript
image: {
  default: 'openai' | 'google' | 'stability' | 'higgsfield' | 'mock';
  model: string;
};
video: {
  default: 'google' | 'runway' | 'higgsfield' | 'mock';
};
```

**Changement 2 :** Ajouter `higgsfield` dans `apiKeys`.

**Avant :**
```typescript
apiKeys: {
  openai: string | undefined;
  anthropic: string | undefined;
  google: string | undefined;
  elevenlabs: string | undefined;
  ollamaBaseUrl: string | undefined;
};
```

**Apres :**
```typescript
apiKeys: {
  openai: string | undefined;
  anthropic: string | undefined;
  google: string | undefined;
  elevenlabs: string | undefined;
  ollamaBaseUrl: string | undefined;
  higgsfield: string | undefined;
};
```

**Changement 3 :** Ajouter la resolution de la cle dans `getEngineConfig()`.

**Ajouter dans `apiKeys` du `_config` :**
```typescript
higgsfield: env.AI_ENGINE_HIGGSFIELD_API_KEY || undefined,
```

### Criteres d'acceptation Phase 1
- [ ] `pnpm tsc --noEmit` passe sans erreur
- [ ] `pnpm build` passe (compilation Next.js)
- [ ] Aucune regression TypeScript dans le projet
- [ ] Le type `ProviderType` inclut `'higgsfield'`
- [ ] L'env var `AI_ENGINE_HIGGSFIELD_API_KEY` est reconnue
- [ ] Les enums image/video acceptent `'higgsfield'`

### Rollback Phase 1
Revert les 3 fichiers : `git checkout HEAD~1 -- src/lib/ai-engine/providers/types.ts src/lib/env.ts src/lib/ai-engine/config/engine-config.ts`

---

## Phase 2 : API Key Management (30 min)

### Objectif
Permettre la detection, le stockage, la validation et la resolution des cles API Higgsfield.

### Prerequis
- Phase 1 terminee et build propre

### Fichier 2.1 : `src/lib/ai-engine/services/api-key-manager.ts`

**Changement 1 :** Ajouter a `PROVIDER_NAMES` (apres `ollama`).

**Ajouter :**
```typescript
higgsfield: 'Higgsfield AI',
```

**Changement 2 :** Ajouter a `ENV_KEY_MAP` (apres `ollama`).

**Ajouter :**
```typescript
higgsfield: ['AI_ENGINE_HIGGSFIELD_API_KEY'],
```

**Changement 3 :** Ajouter `'higgsfield'` dans la liste `providers` de `listApiKeys()` (ligne 60).

**Avant :**
```typescript
const providers = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama'];
```

**Apres :**
```typescript
const providers = ['openai', 'anthropic', 'google', 'elevenlabs', 'ollama', 'higgsfield'];
```

### Fichier 2.2 : `src/lib/ai-engine/services/api-key-validator.ts`

**Changement 1 :** Ajouter le case `'higgsfield'` dans le switch de `validateApiKey()`.

**Ajouter (avant `default:`) :**
```typescript
case 'higgsfield':
  return await testHiggsfield(apiKey, start);
```

**Changement 2 :** Implementer la fonction `testHiggsfield()`.

**Ajouter :**
```typescript
async function testHiggsfield(apiKey: string, start: number): Promise<ValidationResult> {
  const res = await fetch('https://api.higgsfield.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  if (res.status === 401) return { valid: false, provider: 'higgsfield', latencyMs: Date.now() - start, error: 'Invalid API key' };
  // 429 = valid key, just rate limited
  if (res.status === 429) return { valid: true, provider: 'higgsfield', latencyMs: Date.now() - start };
  return { valid: false, provider: 'higgsfield', latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
}
```

### Criteres d'acceptation Phase 2
- [ ] `listApiKeys()` retourne une entree pour `'higgsfield'`
- [ ] `testApiKey('higgsfield', 'valid-key')` retourne `{ valid: true }`
- [ ] `testApiKey('higgsfield', 'invalid-key')` retourne `{ valid: false }`
- [ ] `resolveApiKey('higgsfield')` retourne la cle depuis DB ou env
- [ ] `PROVIDER_NAMES['higgsfield']` === `'Higgsfield AI'`

### Rollback Phase 2
Revert les 2 fichiers : `git checkout HEAD~1 -- src/lib/ai-engine/services/api-key-manager.ts src/lib/ai-engine/services/api-key-validator.ts`

---

## Phase 3 : Model Discovery (30 min)

### Objectif
Permettre la decouverte dynamique des modeles Higgsfield (avec fallback statique).

### Prerequis
- Phase 2 terminee

### Fichier 3.1 : `src/lib/ai-engine/services/model-discovery.ts`

**Changement 1 :** Ajouter `'higgsfield'` au type `DiscoverableProvider`.

**Avant :**
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

**Apres :**
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

**Changement 2 :** Ajouter le role `'video'` au type `ModelEntry.role`.

**Avant :**
```typescript
export interface ModelEntry {
  id: string;
  role: 'chat' | 'embedding' | 'vision' | 'image' | 'tts' | 'code';
}
```

**Apres :**
```typescript
export interface ModelEntry {
  id: string;
  role: 'chat' | 'embedding' | 'vision' | 'image' | 'video' | 'tts' | 'code';
}
```

**Changement 3 :** Ajouter les fallback models pour Higgsfield dans `FALLBACK_MODELS`.

**Ajouter (apres `ollama`) :**
```typescript
higgsfield: [
  { id: 'higgsfield-diffusion-v2', role: 'image' },
  { id: 'higgsfield-xl-v1', role: 'image' },
  { id: 'higgsfield-video-v1', role: 'video' },
  { id: 'higgsfield-video-fast', role: 'video' },
],
```

**Changement 4 :** Ajouter le fetcher `fetchHiggsfield()`.

```typescript
export async function fetchHiggsfield(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.higgsfield.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`higgsfield ${res.status}`);
  const json = (await res.json()) as { models?: Array<{ id: string; type?: string }> };
  return (json.models ?? []).map((m) => ({
    id: m.id,
    role: m.type === 'video' ? 'video' as const : 'image' as const,
  }));
}
```

**Changement 5 :** Ajouter le case dans `callFetcher()`.

**Ajouter (avant `default:`) :**
```typescript
case 'higgsfield':
  if (!opts.apiKey) return null;
  return fetchHiggsfield(opts.apiKey);
```

### Criteres d'acceptation Phase 3
- [ ] `discoverModels('higgsfield')` retourne la liste fallback
- [ ] `discoverModels('higgsfield', { apiKey: 'valid' })` tente un fetch live
- [ ] Les modeles fallback contiennent au moins 1 image + 1 video
- [ ] Le type `ModelEntry.role` inclut `'video'`
- [ ] `FALLBACK_MODELS.higgsfield` est defini et non vide

### Rollback Phase 3
Revert le fichier : `git checkout HEAD~1 -- src/lib/ai-engine/services/model-discovery.ts`

---

## Phase 4 : Adapter Implementation (2-3 heures)

### Objectif
Creer l'adapter Higgsfield qui implemente `generateImage()` et `generateVideo()`.

### Prerequis
- Phase 1 terminee (types disponibles)
- Phase 3 terminee (modeles connus)

### Fichier 4.1 (NOUVEAU) : `src/lib/ai-engine/providers/adapters/higgsfield.ts`

**Pattern :** Suivre la structure de `openai.ts` avec circuit breaker + retry policy.

```typescript
import type {
  ProviderCallResult,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
  VideoGenParams,
  VideoGenResult,
} from '../types';
import { ProviderError, NotImplementedError } from '../types';
import { ProviderAdapter } from './base';

const HIGGSFIELD_BASE_URL = 'https://api.higgsfield.ai/v1';
const VIDEO_POLL_INTERVAL_MS = 3_000;
const VIDEO_POLL_MAX_ATTEMPTS = 120; // 6 min max

export class HiggsFieldAdapter extends ProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  // --- TEXT: not supported ---
  async generateText(
    _params: TextGenParams,
  ): Promise<ProviderCallResult<TextGenResult>> {
    throw new NotImplementedError('generateText', this.name);
  }

  // --- EMBEDDING: not supported ---
  async generateEmbedding(
    _params: EmbeddingParams,
  ): Promise<ProviderCallResult<number[]>> {
    throw new NotImplementedError('generateEmbedding', this.name);
  }

  // --- IMAGE GENERATION ---
  async generateImage(
    params: ImageGenParams,
  ): Promise<ProviderCallResult<ImageGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();

        const body: Record<string, unknown> = {
          model: params.model,
          prompt: params.prompt,
          num_images: params.count ?? 1,
          width: params.width ?? 1024,
          height: params.height ?? 1024,
        };

        if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
        if (params.quality) body.quality = params.quality;
        if (params.style) body.style = params.style;

        const response = await fetch(
          `${HIGGSFIELD_BASE_URL}/images/generate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) {
          const err = await response.text().catch(() => `${response.status}`);
          throw new ProviderError(
            `Higgsfield image generation failed: ${err}`,
            {
              provider: this.name,
              model: params.model,
              retryable: response.status >= 500 || response.status === 429,
              statusCode: response.status,
            },
          );
        }

        const json = (await response.json()) as {
          images: Array<{ url?: string; base64?: string }>;
        };

        const modelConfig = this.config.models.find(
          (m) => m.name === params.model,
        );
        const costCents =
          (modelConfig?.costPerUnit ?? 0) * (params.count ?? 1);
        this.lastCostCents = costCents;

        return {
          data: {
            images: json.images.map((img) => ({
              url: img.url,
              base64: img.base64,
            })),
          },
          costCents,
          tokensUsed: { input: 0, output: 0 },
          latencyMs: Date.now() - start,
          provider: this.name,
          model: params.model,
        };
      }),
    );
  }

  // --- VIDEO GENERATION (async with polling) ---
  override async generateVideo(
    params: VideoGenParams,
  ): Promise<ProviderCallResult<VideoGenResult>> {
    const start = Date.now();

    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();

        // Step 1: Submit video generation job
        const submitBody: Record<string, unknown> = {
          model: params.model,
          prompt: params.prompt,
          duration_seconds: params.durationSeconds ?? 5,
        };

        if (params.imageUrl) submitBody.image_url = params.imageUrl;

        const submitRes = await fetch(
          `${HIGGSFIELD_BASE_URL}/videos/generate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(submitBody),
          },
        );

        if (!submitRes.ok) {
          const err = await submitRes.text().catch(() => `${submitRes.status}`);
          throw new ProviderError(
            `Higgsfield video submission failed: ${err}`,
            {
              provider: this.name,
              model: params.model,
              retryable: submitRes.status >= 500 || submitRes.status === 429,
              statusCode: submitRes.status,
            },
          );
        }

        const submitJson = (await submitRes.json()) as {
          job_id: string;
          status: string;
          video_url?: string;
        };

        // Step 2: If synchronous response, return directly
        if (submitJson.video_url) {
          return this.buildVideoResult(
            submitJson.video_url,
            params.model,
            start,
          );
        }

        // Step 3: Poll for completion
        const jobId = submitJson.job_id;
        for (let attempt = 0; attempt < VIDEO_POLL_MAX_ATTEMPTS; attempt++) {
          await this.sleep(VIDEO_POLL_INTERVAL_MS);

          const pollRes = await fetch(
            `${HIGGSFIELD_BASE_URL}/videos/status/${jobId}`,
            {
              headers: { Authorization: `Bearer ${apiKey}` },
            },
          );

          if (!pollRes.ok) {
            if (pollRes.status >= 500) continue; // transient, retry poll
            const err = await pollRes.text().catch(() => `${pollRes.status}`);
            throw new ProviderError(
              `Higgsfield video poll failed: ${err}`,
              {
                provider: this.name,
                model: params.model,
                retryable: false,
                statusCode: pollRes.status,
              },
            );
          }

          const pollJson = (await pollRes.json()) as {
            status: string;
            video_url?: string;
            error?: string;
          };

          if (pollJson.status === 'completed' && pollJson.video_url) {
            return this.buildVideoResult(
              pollJson.video_url,
              params.model,
              start,
            );
          }

          if (pollJson.status === 'failed') {
            throw new ProviderError(
              `Higgsfield video generation failed: ${pollJson.error ?? 'unknown'}`,
              {
                provider: this.name,
                model: params.model,
                retryable: false,
              },
            );
          }

          // status === 'processing' | 'queued' => continue polling
        }

        throw new ProviderError(
          `Higgsfield video generation timed out after ${VIDEO_POLL_MAX_ATTEMPTS * VIDEO_POLL_INTERVAL_MS / 1000}s`,
          {
            provider: this.name,
            model: params.model,
            retryable: true,
          },
        );
      }),
    );
  }

  // --- Helpers ---

  private buildVideoResult(
    videoUrl: string,
    model: string,
    start: number,
  ): ProviderCallResult<VideoGenResult> {
    const modelConfig = this.config.models.find((m) => m.name === model);
    const costCents = modelConfig?.costPerUnit ?? 0;
    this.lastCostCents = costCents;

    return {
      data: { videoUrl },
      costCents,
      tokensUsed: { input: 0, output: 0 },
      latencyMs: Date.now() - start,
      provider: this.name,
      model,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### Architecture de l'adapter

```
HiggsFieldAdapter extends ProviderAdapter
  |
  |-- generateImage()
  |     |-- circuitBreaker.execute()
  |     |     |-- retryPolicy.execute()
  |     |           |-- POST /v1/images/generate
  |     |           |-- Parse response { images: [{ url, base64 }] }
  |     |           |-- Compute cost from ModelConfig.costPerUnit
  |     |
  |-- generateVideo()
  |     |-- circuitBreaker.execute()
  |     |     |-- retryPolicy.execute()
  |     |           |-- POST /v1/videos/generate (submit job)
  |     |           |-- IF sync response: return video_url
  |     |           |-- ELSE poll GET /v1/videos/status/{job_id}
  |     |           |     |-- Max 120 attempts * 3s = 6 min
  |     |           |     |-- On 'completed': return video_url
  |     |           |     |-- On 'failed': throw ProviderError
  |     |           |-- On timeout: throw retryable ProviderError
  |     |
  |-- generateText()   -> throw NotImplementedError
  |-- generateEmbedding() -> throw NotImplementedError
```

### Criteres d'acceptation Phase 4
- [ ] `HiggsFieldAdapter` compile sans erreur TypeScript
- [ ] `generateImage()` fait un POST correct et parse la reponse
- [ ] `generateVideo()` gere le cas synchrone et le polling asynchrone
- [ ] Circuit breaker et retry policy sont utilises
- [ ] Les couts sont calcules correctement via `ModelConfig.costPerUnit`
- [ ] `generateText()` et `generateEmbedding()` lancement `NotImplementedError`
- [ ] Le polling a un timeout (6 min max) et gere les erreurs

### Risques Phase 4
| Risque | Mitigation |
|--------|------------|
| API response format different | Normaliser dans l'adapter, tester avec MSW |
| Video polling long (> 6 min) | Timeout configurable, retryable error pour retry au niveau ProviderSelector |
| Rate limiting (429) | Marque comme retryable, retry policy gere le backoff |

### Rollback Phase 4
Supprimer le fichier : `rm src/lib/ai-engine/providers/adapters/higgsfield.ts`

---

## Phase 5 : Provider Registration & Routing (30 min)

### Objectif
Enregistrer Higgsfield dans le selector, les routes API providers, et le model discovery route.

### Prerequis
- Phase 4 terminee (adapter disponible)

### Fichier 5.1 : `src/lib/ai-engine/providers/selector.ts`

**Changement :** Ajouter l'import et le case dans `createAdapter()`.

**Ajouter l'import :**
```typescript
import { HiggsFieldAdapter } from './adapters/higgsfield';
```

**Ajouter le case (avant `default:`) :**
```typescript
case 'higgsfield':
  return new HiggsFieldAdapter(config);
```

### Fichier 5.2 : `src/app/api/admin/ai-engine/config/providers/route.ts`

**Changement 1 :** Ajouter l'entree Higgsfield dans `getDefaultProviders()`.

**Ajouter (apres le bloc Ollama, avant la fermeture du tableau) :**
```typescript
{
  id: 'default-higgsfield',
  providerType: 'higgsfield',
  name: 'Higgsfield AI',
  apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
  baseUrl: 'https://api.higgsfield.ai',
  capabilities: ['image', 'video'],
  models: [
    { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
    { name: 'higgsfield-xl-v1', capability: 'image', costPerUnit: 800 },
    { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
    { name: 'higgsfield-video-fast', capability: 'video', costPerUnit: 1200 },
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

**Changement 2 :** Ajouter au `envKeyMap` dans la section DB.

**Ajouter :**
```typescript
AI_ENGINE_HIGGSFIELD_API_KEY: config.apiKeys.higgsfield,
```

### Fichier 5.3 : `src/app/api/admin/ai-engine/config/providers/models/route.ts`

**Changement 1 :** Ajouter `'higgsfield'` a `VALID_PROVIDERS`.

**Avant :**
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

**Apres :**
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

**Changement 2 :** Ajouter le mapping `PROVIDER_TO_DISCOVERY`.

**Ajouter :**
```typescript
higgsfield: 'higgsfield',
```

**Changement 3 :** Ajouter dans `POPULAR_MODELS`.

**Ajouter :**
```typescript
higgsfield: [
  'higgsfield-diffusion-v2',
  'higgsfield-xl-v1',
  'higgsfield-video-v1',
  'higgsfield-video-fast',
],
```

### Criteres d'acceptation Phase 5
- [ ] `createAdapter()` avec `type: 'higgsfield'` retourne un `HiggsFieldAdapter`
- [ ] GET `/api/admin/ai-engine/config/providers` inclut Higgsfield
- [ ] GET `/api/admin/ai-engine/config/providers/models?provider=higgsfield` retourne des modeles
- [ ] Le `ProviderSelector` peut selectionner Higgsfield pour `'image'` et `'video'`
- [ ] La carte Higgsfield apparait dans l'UI Config sans modification frontend

### Rollback Phase 5
Revert les 3 fichiers.

---

## Phase 6 : Node Integration (1 heure)

### Objectif
Refactoriser les nodes `generate-images` et `generate-video` pour utiliser le `ProviderSelector` au lieu d'appels directs a OpenAI.

### Prerequis
- Phase 5 terminee (selector sait creer un HiggsFieldAdapter)

### Fichier 6.1 : `src/lib/ai-engine/nodes/generate-images.ts`

**Refactoring majeur :** Remplacer l'appel direct `generateOpenAIImage()` par le pattern ProviderSelector.

**Concept :**
```typescript
import { ProviderSelector } from '../providers/selector';
import type { ProviderConfig } from '../providers/types';

// Dans generateImagesNode():
// 1. Construire les ProviderConfig depuis getEngineConfig()
// 2. Creer un ProviderSelector
// 3. Selectionner le provider pour 'image'
// 4. Appeler adapter.generateImage()

const providerConfigs = buildProviderConfigs(config);
const selector = new ProviderSelector(providerConfigs, jobId);
const adapter = selector.selectProvider('generate_images', 'image');

for (let i = 0; i < imageCount; i++) {
  const result = await adapter.generateImage({
    model: config.providers.image.model,
    prompt,
    width: platformSpec.width,
    height: platformSpec.height,
    count: 1,
  });

  images.push({
    assetId: `${adapter.config.type}-img-${Date.now()}-${i}`,
    url: result.data.images[0]?.url ?? '',
    mimeType: 'image/png',
    width: platformSpec.width,
    height: platformSpec.height,
    provider: `${adapter.config.type}:${config.providers.image.model}`,
    costCents: result.costCents,
  });
  totalCost += result.costCents;
}
```

**Note :** Conserver le fallback mock et le try/catch existant. Quand `config.providers.image.default === 'mock'`, court-circuiter vers `generateMockImage()`.

### Fichier 6.2 : `src/lib/ai-engine/nodes/generate-video.ts`

**Refactoring :** Remplacer le placeholder "not yet implemented" par un appel via ProviderSelector.

**Concept :**
```typescript
if (config.providers.video.default !== 'mock') {
  const providerConfigs = buildProviderConfigs(config);
  const selector = new ProviderSelector(providerConfigs, jobId);
  const adapter = selector.selectProvider('generate_video', 'video');

  const result = await adapter.generateVideo({
    model: 'higgsfield-video-v1', // ou depuis config
    prompt: scenes.map(s => s.description).join('. '),
    durationSeconds: scenes.reduce((sum, s) => sum + (s.durationSeconds ?? 4), 0),
  });

  videos.push({
    assetId: `video-${Date.now()}`,
    url: result.data.videoUrl,
    mimeType: 'video/mp4',
    width,
    height,
    durationMs: result.latencyMs,
    fileSizeBytes: 0, // Unknown from API
    provider: `${adapter.config.type}:${result.model}`,
    generationParams: { scenes: scenes.length },
    costCents: result.costCents,
  });
  costCents = result.costCents;
} else {
  // Keep existing mock generation
}
```

### Helper partage : `buildProviderConfigs()`

Creer une fonction utilitaire (potentiellement dans `src/lib/ai-engine/config/provider-config-builder.ts`) qui construit les `ProviderConfig[]` depuis `EngineConfig` :

```typescript
export function buildProviderConfigs(config: EngineConfig): ProviderConfig[] {
  const configs: ProviderConfig[] = [];

  if (config.apiKeys.openai) {
    configs.push({
      id: 'runtime-openai',
      type: 'openai',
      name: 'OpenAI',
      apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
      capabilities: ['text', 'image', 'tts', 'embedding', 'moderation', 'vision'],
      models: [/* ... */],
      rateLimitRpm: 500,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.5),
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 10,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
    });
  }

  if (config.apiKeys.higgsfield) {
    configs.push({
      id: 'runtime-higgsfield',
      type: 'higgsfield',
      name: 'Higgsfield AI',
      apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
      capabilities: ['image', 'video'],
      models: [
        { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
        { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
      ],
      rateLimitRpm: 60,
      dailyBudgetCents: Math.round(config.budget.dailyCents * 0.2),
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: 15,
      isFallback: false,
      isEnabled: true,
      healthStatus: 'healthy',
    });
  }

  // ... google, anthropic, etc.
  return configs;
}
```

### Criteres d'acceptation Phase 6
- [ ] `generateImagesNode()` utilise le ProviderSelector
- [ ] Quand `default === 'higgsfield'` et cle configuree, Higgsfield est utilise
- [ ] Quand `default === 'openai'`, OpenAI est utilise (pas de regression)
- [ ] Quand `default === 'mock'`, le mock est utilise (pas de regression)
- [ ] `generateVideoNode()` appelle `adapter.generateVideo()` quand provider != mock
- [ ] Le fallback fonctionne si Higgsfield echoue (circuit breaker -> fallback provider)
- [ ] Les couts sont correctement agrege dans `costTracking`

### Risques Phase 6
| Risque | Mitigation |
|--------|------------|
| Regression sur images OpenAI | Tester le path OpenAI explicitement |
| Build loop de dependances | Provider configs builder isole |
| Video generation lente | Timeout dans l'adapter, fallback mock dans le node |

### Rollback Phase 6
Revert les 2 fichiers + supprimer le builder si cree.

---

## Phase 7 : Tests & Verification (2 heures)

### Objectif
Couvrir l'integration avec des tests unitaires, de contrat, MSW mocks et E2E.

### Prerequis
- Phases 1-6 terminees

### 7.1 MSW Handlers

**Fichier :** `src/test/msw/ai-engine-handlers.ts`

**Ajouts :**

1. Ajouter Higgsfield dans `MOCK_MODEL_DISCOVERY`:
```typescript
higgsfield: {
  models: [
    { id: 'higgsfield-diffusion-v2', role: 'image' },
    { id: 'higgsfield-xl-v1', role: 'image' },
    { id: 'higgsfield-video-v1', role: 'video' },
    { id: 'higgsfield-video-fast', role: 'video' },
  ],
  source: 'fallback',
},
```

2. Ajouter Higgsfield dans `MOCK_PROVIDERS`:
```typescript
{ id: 'prov-higgsfield', providerType: 'higgsfield', name: 'Higgsfield AI', apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY', capabilities: ['image', 'video'], models: [{ name: 'higgsfield-diffusion-v2', costPerUnit: 500 }], isEnabled: true, healthStatus: 'healthy', priority: 15 },
```

3. Ajouter Higgsfield dans `MOCK_API_KEYS`:
```typescript
{ id: null, providerType: 'higgsfield', providerName: 'Higgsfield AI', label: 'Non configure', source: 'none', masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
```

4. Ajouter MSW handlers externes pour l'API Higgsfield:
```typescript
export const higgsFieldApiHandlers = [
  http.post('https://api.higgsfield.ai/v1/images/generate', () => {
    return HttpResponse.json({
      images: [{ url: 'https://cdn.higgsfield.ai/gen/test-image-001.png' }],
    });
  }),

  http.post('https://api.higgsfield.ai/v1/videos/generate', () => {
    return HttpResponse.json({
      job_id: 'hf-job-001',
      status: 'completed',
      video_url: 'https://cdn.higgsfield.ai/gen/test-video-001.mp4',
    });
  }),

  http.get('https://api.higgsfield.ai/v1/videos/status/:jobId', () => {
    return HttpResponse.json({
      status: 'completed',
      video_url: 'https://cdn.higgsfield.ai/gen/test-video-001.mp4',
    });
  }),

  http.get('https://api.higgsfield.ai/v1/models', () => {
    return HttpResponse.json({
      models: [
        { id: 'higgsfield-diffusion-v2', type: 'image' },
        { id: 'higgsfield-video-v1', type: 'video' },
      ],
    });
  }),
];

export const higgsFieldApiErrorHandlers = {
  imageGenError: http.post('https://api.higgsfield.ai/v1/images/generate', () => {
    return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }),

  videoGenError: http.post('https://api.higgsfield.ai/v1/videos/generate', () => {
    return HttpResponse.json({ error: 'Internal error' }, { status: 500 });
  }),

  videoStatusFailed: http.get('https://api.higgsfield.ai/v1/videos/status/:jobId', () => {
    return HttpResponse.json({ status: 'failed', error: 'Content policy violation' });
  }),

  authError: http.post('https://api.higgsfield.ai/v1/images/generate', () => {
    return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }),
};
```

### 7.2 Unit Tests

**Fichier (nouveau) :** `src/lib/ai-engine/providers/adapters/__tests__/higgsfield.test.ts`

Tests a couvrir :
1. `generateImage()` success path
2. `generateImage()` error (500) -> ProviderError retryable
3. `generateImage()` error (401) -> ProviderError non-retryable
4. `generateImage()` cost calculation
5. `generateVideo()` synchronous path (video_url in submit response)
6. `generateVideo()` async path (poll for completion)
7. `generateVideo()` poll timeout
8. `generateVideo()` poll failure
9. `generateText()` throws NotImplementedError
10. `generateEmbedding()` throws NotImplementedError
11. Circuit breaker opens after failures
12. Retry policy respects max retries

**Fichier (nouveau) :** `src/lib/ai-engine/services/__tests__/api-key-validator-higgsfield.test.ts`

Tests a couvrir :
1. `testHiggsfield()` valid key (200)
2. `testHiggsfield()` invalid key (401)
3. `testHiggsfield()` rate limited (429) -> valid
4. `testHiggsfield()` server error (500)
5. `testHiggsfield()` network timeout

**Fichier (nouveau) :** `src/lib/ai-engine/services/__tests__/model-discovery-higgsfield.test.ts`

Tests a couvrir :
1. `discoverModels('higgsfield')` returns fallback without key
2. `discoverModels('higgsfield', { apiKey })` returns live models
3. `fetchHiggsfield()` parses response correctly
4. `FALLBACK_MODELS.higgsfield` contains image and video models
5. Cache invalidation works for higgsfield

### 7.3 Contract Tests

**Fichier (nouveau) :** `src/test/api-contracts/ai-engine-higgsfield.contract.test.ts`

Tests a couvrir :
1. GET `/config/providers` includes higgsfield
2. GET `/config/providers/models?provider=higgsfield` returns models
3. GET `/config/providers/models?provider=higgsfield&capability=image` filters correctly
4. GET `/config/providers/models?provider=higgsfield&capability=video` filters correctly
5. GET `/config/api-keys` includes higgsfield
6. POST `/config/api-keys/test` with higgsfield returns valid/invalid

### 7.4 E2E Tests

**Fichier (nouveau) :** `e2e/content-studio-v2/ai-engine-higgsfield.spec.ts`

Tests a couvrir :
1. Provider card visible in config page
2. Provider card shows capabilities (image, video)
3. Model selector shows Higgsfield models
4. API key management shows Higgsfield row
5. Image/video provider selector includes Higgsfield
6. Generation with Higgsfield provider (mocked)

### Criteres d'acceptation Phase 7
- [ ] Tous les tests unitaires passent (0 failures)
- [ ] Tous les tests de contrat passent
- [ ] Tous les tests E2E passent
- [ ] Coverage adapter > 90%
- [ ] Aucune regression sur les tests existants
- [ ] `pnpm test` global passe
- [ ] `pnpm build` passe

### Rollback Phase 7
Tests only — pas de rollback necessaire.

---

## Synthese des dependances

```
Phase 1 (Types)
  |
  +---> Phase 2 (API Keys)
  |       |
  |       +---> Phase 3 (Discovery)
  |
  +---> Phase 4 (Adapter)
          |
          +---> Phase 5 (Registration)
                  |
                  +---> Phase 6 (Nodes)
                          |
                          +---> Phase 7 (Tests)
```

Phases 2-3 et Phase 4 peuvent s'executer en parallele apres Phase 1.
Phase 5 depend de Phase 4.
Phase 6 depend de Phase 5.
Phase 7 depend de toutes les phases precedentes.

---

## Checklist finale post-integration

- [ ] `pnpm tsc --noEmit` : 0 erreur
- [ ] `pnpm build` : success
- [ ] `pnpm test` : 0 failure, 0 regression
- [ ] `pnpm test:e2e` : 0 failure
- [ ] `.env.example` mis a jour avec `AI_ENGINE_HIGGSFIELD_API_KEY=`
- [ ] Provider visible dans l'UI admin `/admin/content-studio-v2/ai-engine/config`
- [ ] Modeles Higgsfield dans le selecteur de modeles
- [ ] Cle API Higgsfield dans la gestion des cles
- [ ] Generation image utilise Higgsfield quand configure
- [ ] Generation video utilise Higgsfield quand configure
- [ ] Fallback vers mock fonctionne si Higgsfield echoue
- [ ] Circuit breaker se declenche apres 5 echecs consecutifs
- [ ] Les couts sont correctement enregistres dans le cost ledger
