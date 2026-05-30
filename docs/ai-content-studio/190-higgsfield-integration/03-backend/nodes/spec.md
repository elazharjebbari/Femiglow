# Node Refactoring Specification

**Document:** 190-HF/03-backend/nodes/spec.md
**Date:** 2026-05-27
**Scope:** Refactoring generate-images.ts and generate-video.ts to use ProviderSelector
**Impact:** 2 existing files significantly refactored

---

## 1. Overview

Both LangGraph nodes (`generate-images.ts` and `generate-video.ts`) currently bypass the provider abstraction layer:

- `generate-images.ts` calls OpenAI directly via `fetch('https://api.openai.com/v1/images/generations')`
- `generate-video.ts` only generates mock videos via FFmpeg

The refactoring replaces direct provider calls with the `ProviderSelector` pattern, enabling Higgsfield (or any configured provider) to be used transparently.

---

## 2. generate-images.ts Refactoring

### 2.1 Current State Analysis

**File:** `apps/web/src/lib/ai-engine/nodes/generate-images.ts`

**Problems:**
1. **Hardcoded OpenAI:** `generateOpenAIImage()` function directly calls `fetch('https://api.openai.com/v1/images/generations')` (line 74)
2. **No ProviderSelector:** Does not use the adapter pattern at all
3. **Tight coupling:** Provider-specific logic (OpenAI body format, response parsing) is embedded in the node
4. **Limited fallback:** Only falls back to mock on error (line 140-142), not to another real provider
5. **No cost tracking via adapter:** Manually calculates cost (line 100) instead of using adapter's `costPerUnit`

### 2.2 Target State

Replace `generateOpenAIImage()` with a provider-agnostic flow that:
1. Builds a `ProviderSelector` from the engine config
2. Calls `selector.selectProvider('generate_images', 'image')` to get the best adapter
3. Calls `adapter.generateImage(params)` which handles all provider-specific logic
4. On failure, tries `selector.selectFallback()` for automatic failover
5. Falls back to mock as last resort

### 2.3 Before / After Code

**BEFORE (current, lines 113-181):**
```typescript
export async function generateImagesNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const platform = state.platform as string;
  const format = state.format as string;
  const script = state.script as Record<string, unknown> | null;
  const brand = (state.brandGuidelines as string) ?? '';

  log.info('Generating images', { jobId, node: 'generate_images', provider: config.providers.image.default });

  const startTime = Date.now();
  const visualNotes = (script?.visualDirection as VisualNote[]) ?? [
    { element: 'product_hero', style: 'minimal_japanese', colors: ['cream', 'sage'], composition: 'centered' },
  ];

  const platformSpec = PLATFORM_SIZES[platform]?.[format] ?? PLATFORM_SIZES.instagram?.post ?? { width: 1024, height: 1024, size: '1024x1024' };
  const isCarousel = format === 'carousel';
  const imageCount = isCarousel ? Math.min(visualNotes.length, 5) : 1;

  const images: MediaAsset[] = [];
  let totalCost = 0;

  for (let i = 0; i < imageCount; i++) {
    const note = visualNotes[i % visualNotes.length]!;
    const prompt = buildImagePrompt(note, brand);

    try {
      if (config.providers.image.default === 'mock' || !config.apiKeys.openai) {
        images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
      } else {
        const asset = await generateOpenAIImage(
          prompt,
          platformSpec.size,
          i,
          config.apiKeys.openai,
          config.providers.image.model,
        );
        images.push(asset);
        totalCost += asset.costCents;
      }
    } catch (err) {
      log.warn(`Image ${i} generation failed, using mock`, { jobId, node: 'generate_images', data: { error: String(err) } });
      images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
    }
  }
  // ... cost tracking ...
}
```

**AFTER (refactored):**
```typescript
import { ProviderSelector } from '../providers/selector';
import { buildProviderConfigs } from '../config/provider-configs';
import type { ImageGenParams } from '../providers/types';

export async function generateImagesNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const platform = state.platform as string;
  const format = state.format as string;
  const script = state.script as Record<string, unknown> | null;
  const brand = (state.brandGuidelines as string) ?? '';
  const tenantId = (state.tenantId as string) ?? 'default';

  log.info('Generating images', { jobId, node: 'generate_images', provider: config.providers.image.default });

  const startTime = Date.now();
  const visualNotes = (script?.visualDirection as VisualNote[]) ?? [
    { element: 'product_hero', style: 'minimal_japanese', colors: ['cream', 'sage'], composition: 'centered' },
  ];

  const platformSpec = PLATFORM_SIZES[platform]?.[format]
    ?? PLATFORM_SIZES.instagram?.post
    ?? { width: 1024, height: 1024, size: '1024x1024' };
  const isCarousel = format === 'carousel';
  const imageCount = isCarousel ? Math.min(visualNotes.length, 5) : 1;

  const images: MediaAsset[] = [];
  let totalCost = 0;

  // --- Build provider selector ---
  const isMock = config.providers.image.default === 'mock';
  let selector: ProviderSelector | null = null;

  if (!isMock) {
    try {
      const providerConfigs = await buildProviderConfigs();
      selector = new ProviderSelector(providerConfigs, tenantId);
    } catch (err) {
      log.warn('Failed to build ProviderSelector, falling back to mock', {
        jobId, node: 'generate_images', data: { error: String(err) },
      });
    }
  }

  for (let i = 0; i < imageCount; i++) {
    const note = visualNotes[i % visualNotes.length]!;
    const prompt = buildImagePrompt(note, brand);

    if (isMock || !selector) {
      images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
      continue;
    }

    try {
      // --- Try primary provider (Higgsfield priority 15 > OpenAI priority 10 for image) ---
      const adapter = selector.selectProvider('generate_images', 'image');
      const result = await adapter.generateImage({
        model: config.providers.image.model,
        prompt,
        width: platformSpec.width,
        height: platformSpec.height,
        count: 1,
      });

      const url = result.data.images[0]?.url ?? result.data.images[0]?.base64;
      images.push({
        assetId: `${result.provider}-img-${Date.now()}-${i}`,
        url: url ?? '',
        mimeType: 'image/png',
        width: platformSpec.width,
        height: platformSpec.height,
        provider: `${result.provider}:${result.model}`,
        costCents: result.costCents,
      });
      totalCost += result.costCents;

    } catch (primaryErr) {
      log.warn(`Primary image provider failed for image ${i}, trying fallback`, {
        jobId, node: 'generate_images', data: { error: String(primaryErr) },
      });

      try {
        // --- Try fallback provider ---
        const fallback = selector.selectFallback('generate_images', 'image', '');
        const result = await fallback.generateImage({
          model: config.providers.image.model,
          prompt,
          width: platformSpec.width,
          height: platformSpec.height,
          count: 1,
        });

        const url = result.data.images[0]?.url ?? result.data.images[0]?.base64;
        images.push({
          assetId: `${result.provider}-img-${Date.now()}-${i}`,
          url: url ?? '',
          mimeType: 'image/png',
          width: platformSpec.width,
          height: platformSpec.height,
          provider: `${result.provider}:${result.model}`,
          costCents: result.costCents,
        });
        totalCost += result.costCents;

      } catch (fallbackErr) {
        log.warn(`Fallback also failed for image ${i}, using mock`, {
          jobId, node: 'generate_images', data: { error: String(fallbackErr) },
        });
        images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
      }
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Images generated', {
    jobId,
    node: 'generate_images',
    durationMs,
    costCents: totalCost,
    data: { count: images.length },
  });

  // ... cost tracking (unchanged) ...
}
```

### 2.4 Fallback Strategy

```
1. ProviderSelector.selectProvider('generate_images', 'image')
   → Selects highest-priority enabled provider with 'image' capability
   → With Higgsfield at priority 15: Higgsfield first (if healthy + budget ok)
   → Without Higgsfield key: OpenAI (priority 10) or Google (priority 30)

2. On failure → ProviderSelector.selectFallback()
   → Selects next provider, preferring those with isFallback=true
   → Excludes the failed provider
   → e.g., Higgsfield fails → OpenAI fallback → Google fallback

3. On fallback failure → generateMockImage()
   → Zero-cost local placeholder
   → Ensures the pipeline never completely fails
```

### 2.5 Functions to Remove

After refactoring, `generateOpenAIImage()` (lines 67-111) can be **deleted entirely**. All provider-specific logic now lives in the adapters (`OpenAIAdapter.generateImage()`, `HiggsFieldAdapter.generateImage()`, etc.).

---

## 3. generate-video.ts Refactoring

### 3.1 Current State Analysis

**File:** `apps/web/src/lib/ai-engine/nodes/generate-video.ts`

**Problems:**
1. **Mock only:** The entire file generates mock videos via FFmpeg (line 111-116 logs "Non-mock video provider configured but not yet implemented, falling back to mock")
2. **Dead code path:** The `config.providers.video.default !== 'mock' && config.apiKeys.google` check exists but does nothing useful
3. **No adapter integration:** Never calls any provider adapter
4. **FFmpeg dependency:** Mock generation requires `ffmpeg-static` at runtime

### 3.2 Target State

1. When `config.providers.video.default !== 'mock'`, use `ProviderSelector` to select and call the video adapter (Higgsfield or Google)
2. On adapter failure, fall back to mock FFmpeg video
3. Mock path remains as the ultimate fallback and for development

### 3.3 Before / After Code

**BEFORE (current, lines 94-180 -- relevant section):**
```typescript
export async function generateVideoNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const format = state.format as string;

  // ...
  const videos: MediaAsset[] = [];
  let costCents = 0;

  try {
    if (config.providers.video.default !== 'mock' && config.apiKeys.google) {
      log.info('Non-mock video provider configured but not yet implemented, falling back to mock', {
        jobId, node: 'generate_video',
      });
    }

    const result = await generateMockVideo(scenes, width, height, jobId);
    // ... push mock video ...
  } catch (err) {
    // ... push fallback empty video ...
  }
  // ...
}
```

**AFTER (refactored):**
```typescript
import { ProviderSelector } from '../providers/selector';
import { buildProviderConfigs } from '../config/provider-configs';

export async function generateVideoNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const format = state.format as string;
  const tenantId = (state.tenantId as string) ?? 'default';

  log.info('Generating video', { jobId, node: 'generate_video', provider: config.providers.video.default });

  const startTime = Date.now();
  const scenes = extractScenes(state);
  const isVertical = ['reel', 'story', 'shorts'].includes(format);
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;
  const totalDuration = scenes.reduce((sum, s) => sum + (s.durationSeconds ?? 4), 0);

  const videos: MediaAsset[] = [];
  let costCents = 0;

  const isMock = config.providers.video.default === 'mock';

  if (!isMock) {
    // --- Try real provider (Higgsfield or Google) ---
    try {
      const providerConfigs = await buildProviderConfigs();
      const selector = new ProviderSelector(providerConfigs, tenantId);
      const adapter = selector.selectProvider('generate_video', 'video');

      // Build prompt from scenes
      const videoPrompt = scenes
        .map((s) => s.description)
        .join('. ')
        .slice(0, 1000);

      const result = await adapter.generateVideo({
        model: config.providers.video.default === 'higgsfield'
          ? 'higgsfield-video-v1'
          : 'veo-2.0-generate-001',  // Google default
        prompt: videoPrompt,
        durationSeconds: totalDuration,
      });

      costCents = result.costCents;

      videos.push({
        assetId: `${result.provider}-video-${Date.now()}`,
        url: result.data.videoUrl,
        mimeType: 'video/mp4',
        width,
        height,
        durationMs: totalDuration * 1000,
        fileSizeBytes: 0,  // unknown until downloaded
        provider: `${result.provider}:${result.model}`,
        generationParams: {
          scenes: scenes.length,
          totalDuration,
          resolution: `${width}x${height}`,
        },
        costCents,
      });

      log.info('Video generated via provider', {
        jobId, node: 'generate_video',
        durationMs: Date.now() - startTime,
        costCents,
        data: { provider: result.provider, model: result.model },
      });

    } catch (providerErr) {
      log.warn('Provider video generation failed, falling back to mock', {
        jobId, node: 'generate_video',
        data: { error: String(providerErr) },
      });
      // Fall through to mock
    }
  }

  // --- Mock fallback (also used when isMock=true) ---
  if (videos.length === 0) {
    try {
      const result = await generateMockVideo(scenes, width, height, jobId);
      const fileStat = await stat(result.filePath).catch(() => null);

      videos.push({
        assetId: `mock-video-${Date.now()}`,
        url: `${MEDIA_URL_PREFIX}/${result.fileName}`,
        mimeType: 'video/mp4',
        width,
        height,
        durationMs: result.durationSeconds * 1000,
        fileSizeBytes: fileStat?.size ?? 0,
        provider: 'mock',
        generationParams: {
          scenes: scenes.length,
          totalDuration: result.durationSeconds,
          resolution: `${width}x${height}`,
        },
        costCents: 0,
      });
    } catch (mockErr) {
      log.error('Mock video generation also failed', {
        jobId, node: 'generate_video',
        data: { error: String(mockErr) },
      });

      videos.push({
        assetId: `fallback-video-${Date.now()}`,
        url: '',
        mimeType: 'video/mp4',
        width,
        height,
        durationMs: 0,
        fileSizeBytes: 0,
        provider: 'fallback',
        generationParams: { error: String(mockErr) },
        costCents: 0,
      });
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Video generated', {
    jobId, node: 'generate_video', durationMs, costCents,
    data: { count: videos.length, provider: videos[0]?.provider },
  });

  // ... cost tracking (unchanged) ...
}
```

### 3.4 Fallback Strategy

```
1. config.providers.video.default === 'mock'
   → Skip provider entirely, go straight to FFmpeg mock
   → Zero cost, instant, works offline

2. ProviderSelector.selectProvider('generate_video', 'video')
   → Selects Higgsfield (priority 15) or Google (priority 30)
   → Calls adapter.generateVideo() which handles polling internally

3. Provider fails → Fall through to mock
   → Unlike images (which try primary → fallback → mock), video uses
     primary → mock because video generation is expensive and slow.
     A second provider attempt would double the latency budget.

4. Mock fails → Empty fallback video
   → Last resort: empty MediaAsset with url=''
   → Allows the pipeline to continue (compose step handles missing video)
```

### 3.5 Platform Specs Integration

The current `generate-video.ts` uses hardcoded width/height logic:

```typescript
const isVertical = ['reel', 'story', 'shorts'].includes(format);
const width = isVertical ? 1080 : 1920;
const height = isVertical ? 1920 : 1080;
```

This should eventually be unified with `PLATFORM_SIZES` from `generate-images.ts` or extracted to a shared `platform-specs.ts`. However, this is a **separate refactoring** from the Higgsfield integration and should not block it.

**Recommendation:** Keep the current width/height logic for now. Create a follow-up ticket to extract `PLATFORM_SIZES` into `src/lib/ai-engine/config/platform-specs.ts` and use it in both nodes.

---

## 4. Shared Helper: buildProviderConfigs()

Both refactored nodes need to convert the engine config into `ProviderConfig[]` for `ProviderSelector`. This should be a shared utility:

**New file (optional, can also inline):** `src/lib/ai-engine/config/provider-configs.ts`

```typescript
import { getEngineConfig } from './engine-config';
import { db } from '@/lib/db/client';
import { aiEngineProviderConfigs } from '@/lib/db/schema-ai-engine';
import type { ProviderConfig } from '../providers/types';
import { ProviderConfig as ProviderConfigSchema } from '../providers/types';

/**
 * Build ProviderConfig[] from DB (if available) or default config.
 * Used by LangGraph nodes to initialize ProviderSelector.
 */
export async function buildProviderConfigs(): Promise<ProviderConfig[]> {
  const database = db();

  if (database) {
    const rows = await database
      .select()
      .from(aiEngineProviderConfigs)
      .where(/* isEnabled = true */);

    if (rows.length > 0) {
      return rows.map((r) => ProviderConfigSchema.parse({
        id: r.id,
        type: r.providerType,
        name: r.name,
        apiKeyEnvVar: r.apiKeyEnvVar,
        baseUrl: r.baseUrl ?? undefined,
        capabilities: r.capabilities,
        models: r.models,
        rateLimitRpm: r.rateLimitRpm ?? 60,
        dailyBudgetCents: r.dailyBudgetCents ?? 1000,
        circuitBreaker: r.circuitBreakerConfig ?? {},
        priority: r.priority,
        isFallback: r.isFallback,
        isEnabled: r.isEnabled,
        healthStatus: r.healthStatus,
      }));
    }
  }

  // Fallback: build from engine config (same as getDefaultProviders in providers/route.ts)
  return buildDefaultProviderConfigs();
}
```

**Rationale:** Avoids duplicating the DB-fetch-or-default logic in each node. The `getDefaultProviders()` function in `providers/route.ts` already does this for the API; `buildProviderConfigs()` does the same for internal node use.

---

## 5. Summary of Changes

| File | Change Type | Lines Added | Lines Removed | Complexity |
|------|-------------|-------------|---------------|------------|
| `generate-images.ts` | Major refactor | ~60 | ~45 | Medium |
| `generate-video.ts` | Major refactor | ~50 | ~10 | Medium |
| `provider-configs.ts` | New file (optional) | ~40 | 0 | Low |

**Key principle:** The nodes become provider-agnostic. They speak in terms of `ImageGenParams` / `VideoGenParams` and let the adapter layer handle all provider-specific HTTP calls, response parsing, and error handling.

---

## 6. Migration Path

The refactoring can be done incrementally:

**Phase 1 (safe):** Add `buildProviderConfigs()` helper and import it in both nodes. No behavioral change yet.

**Phase 2 (generate-images.ts):** Replace `generateOpenAIImage()` with `adapter.generateImage()`. Delete `generateOpenAIImage()`. All existing image tests should pass because the adapter for OpenAI produces the same output format.

**Phase 3 (generate-video.ts):** Replace the mock-only path with provider-first + mock-fallback. Existing mock tests continue to pass (mock path still exists). New tests cover the provider path.

**Phase 4 (cleanup):** Remove the `PLATFORM_SIZES` duplication if `platform-specs.ts` is created.
