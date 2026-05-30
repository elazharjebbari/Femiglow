# Audit d'Integration — Higgsfield AI Provider

**Date:** 2026-05-27
**Scope:** Integration de Higgsfield AI comme provider image/video dans l'AI Engine
**Status:** Aucune reference Higgsfield existante dans le codebase

---

## 1. Resume Executif

L'AI Engine FemiGlow est construit sur une architecture modulaire provider-agnostic (LangGraph + adapters).
L'integration de Higgsfield AI necessite des modifications sur **10 fichiers existants** et la creation de **1 nouveau fichier** (adapter).

**Capabilities cibles:** image generation + video generation
**Priorite:** Provider primaire pour image/video (priority 15), avec OpenAI/Google en fallback

---

## 2. Architecture Provider Actuelle

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ LangGraph   │────▶│ ProviderSelector │────▶│ ProviderAdapter │
│ Nodes       │     │ selector.ts      │     │ (abstract)      │
│             │     │                  │     │                 │
│ generate-   │     │ Filtres:         │     │ ▼ OpenAI        │
│  images.ts  │     │  - capability    │     │ ▼ Anthropic     │
│ generate-   │     │  - health        │     │ ▼ Google        │
│  video.ts   │     │  - budget        │     │ ▼ Higgsfield ← │
│ compose.ts  │     │  - priority      │     │ (à créer)       │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Providers actuels

| Provider | Capabilities | Priority | Status |
|----------|-------------|----------|--------|
| OpenAI | text, image, tts, embedding, moderation, vision | 10 | Adapter OK |
| Anthropic | text, vision | 20 | Adapter OK |
| Google | text, image, video, embedding, vision | 30 | Adapter OK |
| ElevenLabs | tts | 40 | Pas d'adapter |
| Ollama | text, embedding | 99 | Pas d'adapter |
| Runway | video | — | Type defini, pas d'adapter |
| Stability | image | — | Type defini, pas d'adapter |
| **Higgsfield** | **image, video** | **15** | **A creer** |

---

## 3. Points d'Integration (10 fichiers + 1 nouveau)

### 3.1 Type System

**Fichier:** `src/lib/ai-engine/providers/types.ts`
- Ajouter `'higgsfield'` a `ProviderType` enum (ligne 19-27)
- Impact: validation Zod + type safety TypeScript

```typescript
// Avant
const ProviderType = z.enum(['openai','anthropic','google','ollama','elevenlabs','runway','stability']);

// Apres
const ProviderType = z.enum(['openai','anthropic','google','ollama','elevenlabs','runway','stability','higgsfield']);
```

### 3.2 Provider Selector

**Fichier:** `src/lib/ai-engine/providers/selector.ts`
- Ajouter `case 'higgsfield'` dans `createAdapter()` (ligne 9-20)

```typescript
case 'higgsfield': return new HiggsFieldAdapter(config);
```

### 3.3 Adapter (NOUVEAU FICHIER)

**Fichier a creer:** `src/lib/ai-engine/providers/adapters/higgsfield.ts`

Pattern a suivre (copie de openai.ts):
1. Etendre `ProviderAdapter`
2. Implementer `generateImage()` — appel API Higgsfield
3. Implementer `generateVideo()` — appel API Higgsfield
4. `generateText()` / `generateEmbedding()` → `throw NotImplementedError`
5. Wrapper circuit breaker + retry policy

```typescript
export class HiggsFieldAdapter extends ProviderAdapter {
  async generateImage(params: ImageGenParams): Promise<ProviderCallResult<ImageGenResult>> {
    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        const apiKey = this.getApiKey();
        // POST https://api.higgsfield.ai/v1/images/generate
        // Authorization: Bearer ${apiKey}
        // Body: { model, prompt, width, height, ... }
        // Response: { images: [{ url }] }
      })
    );
  }

  async generateVideo(params: VideoGenParams): Promise<ProviderCallResult<VideoGenResult>> {
    // POST https://api.higgsfield.ai/v1/videos/generate
    // Potentiellement asynchrone (poll pour status)
  }
}
```

### 3.4 Configuration Environnement

**Fichier:** `src/lib/env.ts`
- Ajouter `AI_ENGINE_HIGGSFIELD_API_KEY: z.string().optional()` au schema
- Ajouter `'higgsfield'` aux enums `AI_ENGINE_DEFAULT_IMAGE_PROVIDER` et `AI_ENGINE_DEFAULT_VIDEO_PROVIDER`
- Ajouter au bloc `parse()`: `AI_ENGINE_HIGGSFIELD_API_KEY: process.env.AI_ENGINE_HIGGSFIELD_API_KEY`

### 3.5 Engine Config

**Fichier:** `src/lib/ai-engine/config/engine-config.ts`
- Ajouter `'higgsfield'` aux unions de type image et video
- Ajouter `higgsfield?: string` dans `apiKeys`

```typescript
image: { default: 'openai' | 'google' | 'stability' | 'higgsfield' | 'mock'; model: string };
video: { default: 'google' | 'runway' | 'higgsfield' | 'mock' };
apiKeys: { openai, anthropic, google, elevenlabs, ollamaBaseUrl, higgsfield };
```

### 3.6 API Key Manager

**Fichier:** `src/lib/ai-engine/services/api-key-manager.ts`
- Ajouter a `PROVIDER_NAMES`: `higgsfield: 'Higgsfield AI'`
- Ajouter a `ENV_KEY_MAP`: `higgsfield: ['AI_ENGINE_HIGGSFIELD_API_KEY']`
- Ajouter `'higgsfield'` dans la liste des providers (ligne 60)

### 3.7 API Key Validator

**Fichier:** `src/lib/ai-engine/services/api-key-validator.ts`
- Ajouter `case 'higgsfield': return await testHiggsfield(apiKey, start);`
- Implementer `testHiggsfield()`: GET health endpoint avec Bearer auth

### 3.8 Model Discovery

**Fichier:** `src/lib/ai-engine/services/model-discovery.ts`
- Ajouter `'higgsfield'` a `DiscoverableProvider`
- Ajouter fallback models:
  ```typescript
  higgsfield: [
    { id: 'higgsfield-diffusion-v2', role: 'image' },
    { id: 'higgsfield-video-v1', role: 'video' },
  ]
  ```
- Implementer `fetchHiggsfield()` si API listing disponible
- Ajouter dans `callFetcher()` switch

### 3.9 Default Provider Registration

**Fichier:** `src/app/api/admin/ai-engine/config/providers/route.ts`
- Ajouter dans `getDefaultProviders()`:

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
    { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
  ],
  rateLimitRpm: 60,
  dailyBudgetCents: Math.round(config.budget.dailyCents * 0.2),
  priority: 15,
  isFallback: false,
  isEnabled: true,
  healthStatus: 'healthy',
  configured: !!config.apiKeys.higgsfield,
}
```

### 3.10 Providers Models API

**Fichier:** `src/app/api/admin/ai-engine/config/providers/models/route.ts`
- Ajouter `'higgsfield'` dans `VALID_PROVIDERS`
- Ajouter mapping dans `PROVIDER_TO_DISCOVERY`
- Ajouter dans `POPULAR_MODELS`

---

## 4. Nodes de Generation — Impact

### 4.1 generate-images.ts (MODIFICATION NECESSAIRE)

**Etat actuel:** Couple a OpenAI (appel direct `fetch('https://api.openai.com/v1/images/generations')`).

**Refactoring necessaire:** Utiliser le `ProviderSelector` au lieu d'appeler OpenAI directement:
```typescript
const selector = new ProviderSelector(providerConfigs, tenantId);
const adapter = selector.selectProvider('generate_images', 'image');
const result = await adapter.generateImage({ model, prompt, width, height });
```

### 4.2 generate-video.ts (PRET POUR INTEGRATION)

**Etat actuel:** Mock only — le code dit "Non-mock video provider configured but not yet implemented".
Pret pour connecter l'adapter Higgsfield.

### 4.3 compose.ts (AUCUN CHANGEMENT)

Assemblage FFmpeg — provider-agnostic.

---

## 5. Schema Base de Donnees — AUCUN CHANGEMENT

Les tables existantes sont provider-agnostiques:
- `ai_engine_provider_config` → `providerType: text` (pas d'enum DB)
- `ai_engine_api_key` → `providerType: text`
- `ai_engine_cost_ledger` → `provider: text`

Higgsfield s'insere sans migration.

---

## 6. UI — AUCUN CHANGEMENT

La page Config et le `ModelSelector` sont generiques:
- `ProviderCard` affiche n'importe quel provider depuis la liste API
- `ModelSelector` fetch les modeles dynamiquement
- L'onglet "Cles API" detecte automatiquement les providers configures

Higgsfield apparaitra automatiquement une fois ajoute au backend.

---

## 7. Questions Ouvertes (a confirmer avant implementation)

| # | Question | Impact |
|---|----------|--------|
| 1 | URL de base API Higgsfield ? | Adapter baseUrl |
| 2 | Methode d'authentification ? (Bearer, API-Key header, query param) | Adapter + validator |
| 3 | Endpoint listing modeles ? | Model discovery |
| 4 | Format reponse images ? (URL, base64, S3 presigned) | Adapter response parsing |
| 5 | Generation video synchrone ou asynchrone (poll) ? | Adapter complexity |
| 6 | Modeles disponibles et noms exacts ? | Fallback models + default config |
| 7 | Pricing par image / video ? | costPerUnit dans ModelConfig |
| 8 | Rate limits ? | rateLimitRpm |
| 9 | Codes HTTP retryable ? | ProviderError.retryable flag |

---

## 8. Plan d'Execution (7 phases)

| Phase | Description | Fichiers | Effort |
|-------|-------------|----------|--------|
| 1 | Type system + config | types.ts, env.ts, engine-config.ts | S (< 1h) |
| 2 | API key management | api-key-manager.ts, api-key-validator.ts | S |
| 3 | Model discovery | model-discovery.ts | S |
| 4 | Adapter implementation | adapters/higgsfield.ts (NOUVEAU) | M (2-4h) |
| 5 | Provider registration | providers/route.ts, models/route.ts, selector.ts | S |
| 6 | Node refactoring | generate-images.ts, generate-video.ts | M |
| 7 | Tests + MSW handlers | *.test.ts, ai-engine-handlers.ts | M |

**Effort total estime:** 1-2 jours

---

## 9. Risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| API Higgsfield instable ou lente | Moyen | Haut | Circuit breaker + retry + fallback OpenAI |
| Video generation asynchrone (long-poll) | Haut | Moyen | Implementer polling avec timeout |
| Format reponse non standard | Moyen | Moyen | Normaliser dans l'adapter |
| Regression sur nodes existants | Faible | Haut | Tests exhaustifs + build verification |
| Pricing change Higgsfield | Faible | Faible | ModelConfig updatable via UI |
