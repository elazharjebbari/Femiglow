# HiggsFieldAdapter -- Detailed Backend Specification

**Document:** 190-HF/03-backend/adapter/spec.md
**Date:** 2026-05-27
**Status:** Draft -- pending Higgsfield API documentation confirmation
**File to create:** `apps/web/src/lib/ai-engine/providers/adapters/higgsfield.ts`

---

## 1. Class Diagram

```
                  ┌──────────────────────────┐
                  │    ProviderAdapter        │  (abstract, base.ts)
                  │──────────────────────────│
                  │ +config: ProviderConfig   │
                  │ #circuitBreaker: CB       │
                  │ #retryPolicy: RetryPolicy │
                  │ #lastCostCents: number    │
                  │──────────────────────────│
                  │ +generateText()*          │
                  │ +generateImage()*         │
                  │ +generateEmbedding()*     │
                  │ +generateVideo()          │  (default: NotImplementedError)
                  │ +textToSpeech()           │  (default: NotImplementedError)
                  │ #getApiKey(): string      │
                  │ #computeCostCents()       │
                  └───────────┬──────────────┘
                              │ extends
                  ┌───────────┴──────────────┐
                  │   HiggsFieldAdapter       │  (NEW FILE)
                  │──────────────────────────│
                  │ -BASE_URL: string         │
                  │ -POLL_INTERVAL_MS: number │
                  │ -POLL_TIMEOUT_MS: number  │
                  │──────────────────────────│
                  │ +generateImage()          │  ← implements abstract
                  │ +generateVideo()          │  ← overrides default
                  │ +generateText()           │  ← throws NotImplementedError
                  │ +generateEmbedding()      │  ← throws NotImplementedError
                  │ -buildImageRequest()      │
                  │ -buildVideoRequest()      │
                  │ -pollVideoStatus()        │
                  │ -mapHttpError()           │
                  │ -isRetryableStatus()      │
                  └──────────────────────────┘
```

---

## 2. Constructor

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

export class HiggsFieldAdapter extends ProviderAdapter {
  private static readonly BASE_URL = 'https://api.higgsfield.ai/v1';
  private static readonly POLL_INTERVAL_MS = 5_000;   // 5 seconds between polls
  private static readonly POLL_TIMEOUT_MS = 300_000;   // 5 minutes max wait
  private static readonly REQUEST_TIMEOUT_MS = 30_000;  // 30s per HTTP call

  constructor(config: ProviderConfig) {
    super(config);
  }
}
```

**Rationale:** Follows the same pattern as `OpenAIAdapter` constructor -- receives `ProviderConfig`, delegates to `super(config)` which initializes `circuitBreaker` and `retryPolicy`. The `BASE_URL` is overridable via `config.baseUrl` for testing (see `getBaseUrl()` helper below).

---

## 3. Helper: getBaseUrl()

```typescript
private getBaseUrl(): string {
  return this.config.baseUrl?.replace(/\/$/, '') ?? HiggsFieldAdapter.BASE_URL;
}
```

Allows dev/staging to override via ProviderConfig.baseUrl (e.g., for MSW or a test double).

---

## 4. generateImage(params)

### 4.1 Request Format

```
POST {baseUrl}/images/generate
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "higgsfield-diffusion-v2",
  "prompt": "...",
  "negative_prompt": "...",           // optional
  "width": 1024,
  "height": 1024,
  "num_images": 1,
  "quality": "standard"              // optional: "standard" | "hd"
}
```

### 4.2 Response Format

```json
{
  "images": [
    {
      "url": "https://cdn.higgsfield.ai/gen/abc123.png",
      "width": 1024,
      "height": 1024
    }
  ],
  "model": "higgsfield-diffusion-v2",
  "usage": {
    "generation_count": 1
  }
}
```

### 4.3 Full Implementation Pseudocode

```typescript
async generateImage(
  params: ImageGenParams,
): Promise<ProviderCallResult<ImageGenResult>> {
  const start = Date.now();

  return this.circuitBreaker.execute(() =>
    this.retryPolicy.execute(async () => {
      const apiKey = this.getApiKey();
      const baseUrl = this.getBaseUrl();

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

      const response = await fetch(`${baseUrl}/images/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => `${response.status}`);
        throw this.mapHttpError(
          response.status,
          errText,
          params.model,
          'image generation',
        );
      }

      const json = (await response.json()) as {
        images: Array<{ url?: string; base64?: string }>;
      };

      // --- Cost calculation (same pattern as OpenAIAdapter) ---
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
```

### 4.4 Error Handling

HTTP errors are mapped through `mapHttpError()`:

| HTTP Status | ProviderError.retryable | Rationale |
|-------------|------------------------|-----------|
| 400 | false | Bad request (invalid params) |
| 401 | false | Invalid API key |
| 403 | false | Forbidden (plan/scope) |
| 404 | false | Endpoint not found |
| 422 | false | Unprocessable entity |
| 429 | true | Rate limited -- retry after backoff |
| 500 | true | Internal server error |
| 502 | true | Bad gateway |
| 503 | true | Service unavailable |
| 504 | true | Gateway timeout |

### 4.5 Cost Calculation

Uses the same `modelConfig.costPerUnit * count` pattern as `OpenAIAdapter.generateImage()`.
The `costPerUnit` is set per model in the ProviderConfig (e.g., 500 = $0.05 per image for higgsfield-diffusion-v2).

---

## 5. generateVideo(params)

### 5.1 Strategy: Asynchronous Polling

Video generation is inherently slow (30s--5min). Higgsfield uses an **asynchronous job model**:

1. **Submit** -- POST to create a video generation job, receive a `jobId`
2. **Poll** -- GET the job status every 5s until `status === 'completed'` or timeout
3. **Download** -- Extract the `videoUrl` from the completed job

```
  Client                    Higgsfield API
    │                            │
    │  POST /videos/generate     │
    │ ──────────────────────────►│
    │   { model, prompt, ... }   │
    │                            │
    │  202 { job_id: "abc123" }  │
    │ ◄──────────────────────────│
    │                            │
    │  GET /videos/status/abc123 │   ← Poll #1 (t+5s)
    │ ──────────────────────────►│
    │  200 { status:"processing"}│
    │ ◄──────────────────────────│
    │                            │
    │  GET /videos/status/abc123 │   ← Poll #2 (t+10s)
    │ ──────────────────────────►│
    │  200 { status:"processing"}│
    │ ◄──────────────────────────│
    │                            │
    │  GET /videos/status/abc123 │   ← Poll #3 (t+15s)
    │ ──────────────────────────►│
    │  200 { status:"completed", │
    │        video_url:"https.."}│
    │ ◄──────────────────────────│
```

### 5.2 Submit Request Format

```
POST {baseUrl}/videos/generate
Authorization: Bearer {apiKey}
Content-Type: application/json

{
  "model": "higgsfield-video-v1",
  "prompt": "...",
  "image_url": "https://...",       // optional: image-to-video
  "duration_seconds": 5,            // optional, default 5
  "width": 1080,                    // optional
  "height": 1920                    // optional
}
```

### 5.3 Submit Response Format

```json
{
  "job_id": "hf-vid-abc123",
  "status": "queued",
  "estimated_seconds": 60
}
```

HTTP 202 Accepted on success.

### 5.4 Poll Request / Response

```
GET {baseUrl}/videos/status/{job_id}
Authorization: Bearer {apiKey}
```

Response:
```json
{
  "job_id": "hf-vid-abc123",
  "status": "queued" | "processing" | "completed" | "failed",
  "video_url": "https://cdn.higgsfield.ai/gen/vid-abc123.mp4",  // only when completed
  "error": "...",                                                 // only when failed
  "progress_pct": 65                                              // optional
}
```

### 5.5 Full Implementation Pseudocode

```typescript
async generateVideo(
  params: VideoGenParams,
): Promise<ProviderCallResult<VideoGenResult>> {
  const start = Date.now();

  return this.circuitBreaker.execute(() =>
    this.retryPolicy.execute(async () => {
      const apiKey = this.getApiKey();
      const baseUrl = this.getBaseUrl();

      // --- Step 1: Submit job ---
      const submitBody: Record<string, unknown> = {
        model: params.model,
        prompt: params.prompt,
        duration_seconds: params.durationSeconds ?? 5,
      };

      if (params.imageUrl) submitBody.image_url = params.imageUrl;

      const submitRes = await fetch(`${baseUrl}/videos/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitBody),
        signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => `${submitRes.status}`);
        throw this.mapHttpError(
          submitRes.status,
          errText,
          params.model,
          'video generation submit',
        );
      }

      const submitJson = (await submitRes.json()) as {
        job_id: string;
        status: string;
      };

      // --- Step 2: Poll for completion ---
      const videoUrl = await this.pollVideoStatus(
        baseUrl,
        apiKey,
        submitJson.job_id,
        params.model,
      );

      // --- Step 3: Return result ---
      const modelConfig = this.config.models.find(
        (m) => m.name === params.model,
      );
      const costCents = modelConfig?.costPerUnit ?? 0;
      this.lastCostCents = costCents;

      return {
        data: { videoUrl },
        costCents,
        tokensUsed: { input: 0, output: 0 },
        latencyMs: Date.now() - start,
        provider: this.name,
        model: params.model,
      };
    }),
  );
}
```

### 5.6 Polling Implementation

```typescript
private async pollVideoStatus(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  model: string,
): Promise<string> {
  const deadline = Date.now() + HiggsFieldAdapter.POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await this.sleep(HiggsFieldAdapter.POLL_INTERVAL_MS);

    const res = await fetch(`${baseUrl}/videos/status/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(HiggsFieldAdapter.REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Transient poll failures -- log and keep trying until deadline
      if (res.status >= 500) continue;
      const errText = await res.text().catch(() => `${res.status}`);
      throw this.mapHttpError(res.status, errText, model, 'video poll');
    }

    const json = (await res.json()) as {
      status: string;
      video_url?: string;
      error?: string;
    };

    switch (json.status) {
      case 'completed':
        if (!json.video_url) {
          throw new ProviderError(
            'Higgsfield video completed but no video_url in response',
            { provider: this.name, model, retryable: false },
          );
        }
        return json.video_url;

      case 'failed':
        throw new ProviderError(
          `Higgsfield video generation failed: ${json.error ?? 'unknown'}`,
          { provider: this.name, model, retryable: false },
        );

      case 'queued':
      case 'processing':
        // Continue polling
        break;

      default:
        // Unknown status -- keep polling
        break;
    }
  }

  throw new ProviderError(
    `Higgsfield video generation timed out after ${HiggsFieldAdapter.POLL_TIMEOUT_MS}ms for job ${jobId}`,
    { provider: this.name, model, retryable: true },
  );
}

private sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 5.7 Timeout Strategy

| Timeout | Value | Context |
|---------|-------|---------|
| HTTP request timeout | 30s | Each individual fetch() call |
| Poll interval | 5s | Between status checks |
| Poll total timeout | 5min | Max wait before giving up |
| Retry policy (circuit breaker wrapper) | 3 retries | Covers submit step only |

Note: The retry policy wraps the entire `generateVideo` operation. If the submit succeeds but polling times out, that is treated as a single failure for circuit breaker purposes. The polling loop does NOT retry transient 5xx failures on the poll endpoint -- it simply continues polling until the deadline.

---

## 6. generateText() / generateEmbedding() -- Not Supported

```typescript
async generateText(
  _params: TextGenParams,
): Promise<ProviderCallResult<TextGenResult>> {
  throw new NotImplementedError('generateText', this.name);
}

async generateEmbedding(
  _params: EmbeddingParams,
): Promise<ProviderCallResult<number[]>> {
  throw new NotImplementedError('generateEmbedding', this.name);
}
```

Higgsfield is a visual-only provider. These methods satisfy the abstract contract in `ProviderAdapter` by throwing `NotImplementedError`, which is the same pattern used in `base.ts` for `generateVideo()` and `textToSpeech()` on providers that do not support those capabilities. The `ProviderSelector` will never route text/embedding requests to Higgsfield because its `capabilities` array only contains `['image', 'video']`.

---

## 7. Error Mapping: mapHttpError()

```typescript
private mapHttpError(
  status: number,
  body: string,
  model: string,
  operation: string,
): ProviderError {
  const retryable = this.isRetryableStatus(status);
  const truncatedBody = body.slice(0, 500);

  return new ProviderError(
    `Higgsfield ${operation} failed (HTTP ${status}): ${truncatedBody}`,
    {
      provider: this.name,
      model,
      retryable,
      statusCode: status,
    },
  );
}

private isRetryableStatus(status: number): boolean {
  // 429 (rate limit) and 5xx (server errors) are retryable
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}
```

This aligns with the `RetryPolicy` in `retry.ts`, which checks `NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404, 422])` and defers to `ProviderError.retryable` for the decision.

---

## 8. Integration with Circuit Breaker and Retry

Both `generateImage` and `generateVideo` wrap their core logic in the same double-layer pattern used by `OpenAIAdapter`:

```
circuitBreaker.execute(() =>
  retryPolicy.execute(async () => {
    // actual API call
  })
)
```

**Failure flow:**
1. HTTP error occurs -> `mapHttpError()` creates `ProviderError` with `retryable` flag
2. `RetryPolicy.execute()` checks `ProviderError.retryable`:
   - `true` (429, 5xx) -> retry with exponential backoff (1s, 2s, 4s)
   - `false` (400, 401, 403, 404, 422) -> throw immediately, no retry
3. If all retries exhausted -> error propagates to `CircuitBreaker`
4. `CircuitBreaker` increments `failureCount`
5. After `failureThreshold` (default 5) consecutive failures -> state transitions to `OPEN`
6. `OPEN` state -> all subsequent calls immediately throw without hitting Higgsfield
7. After `resetTimeoutMs` (default 60s) -> transitions to `HALF_OPEN`, allows 1 probe call
8. Probe succeeds -> transitions to `CLOSED`, normal operation resumes

---

## 9. Complete File Structure

```typescript
// apps/web/src/lib/ai-engine/providers/adapters/higgsfield.ts

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

export class HiggsFieldAdapter extends ProviderAdapter {
  private static readonly BASE_URL = 'https://api.higgsfield.ai/v1';
  private static readonly POLL_INTERVAL_MS = 5_000;
  private static readonly POLL_TIMEOUT_MS = 300_000;
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  constructor(config: ProviderConfig) {
    super(config);
  }

  // --- Image generation (synchronous) ---
  async generateImage(params: ImageGenParams): Promise<ProviderCallResult<ImageGenResult>> { ... }

  // --- Video generation (async polling) ---
  async generateVideo(params: VideoGenParams): Promise<ProviderCallResult<VideoGenResult>> { ... }

  // --- Not supported ---
  async generateText(_params: TextGenParams): Promise<ProviderCallResult<TextGenResult>> {
    throw new NotImplementedError('generateText', this.name);
  }

  async generateEmbedding(_params: EmbeddingParams): Promise<ProviderCallResult<number[]>> {
    throw new NotImplementedError('generateEmbedding', this.name);
  }

  // --- Private helpers ---
  private getBaseUrl(): string { ... }
  private async pollVideoStatus(...): Promise<string> { ... }
  private mapHttpError(...): ProviderError { ... }
  private isRetryableStatus(status: number): boolean { ... }
  private sleep(ms: number): Promise<void> { ... }
}
```

---

## 10. Open Questions (Adapter-Specific)

These were flagged in the audit. The spec above uses **assumed defaults** (marked with ?) that must be confirmed against Higgsfield API documentation before implementation:

| # | Assumption | Needs Confirmation |
|---|-----------|-------------------|
| 1 | Base URL is `https://api.higgsfield.ai/v1` | Actual API base URL |
| 2 | Auth is `Authorization: Bearer {key}` | Could be `X-API-Key` header |
| 3 | Image endpoint is `/images/generate` | Exact path |
| 4 | Image response has `{ images: [{ url }] }` | Actual response schema |
| 5 | Video is async with polling via `/videos/status/{job_id}` | Could be webhook-based |
| 6 | Video response has `{ video_url: "..." }` when completed | Actual field name |
| 7 | Model names: `higgsfield-diffusion-v2`, `higgsfield-video-v1` | Exact model identifiers |
| 8 | Cost: 500 cents ($5.00) per image, 2000 ($20.00) per video | Actual pricing |
