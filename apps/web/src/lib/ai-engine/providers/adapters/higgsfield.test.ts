import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';
import type {
  ProviderConfig,
  ImageGenParams,
  VideoGenParams,
  TextGenParams,
  EmbeddingParams,
} from '../types';
import { ProviderError, NotImplementedError } from '../types';
import { RetryPolicy } from '../retry';
import { HiggsFieldAdapter } from './higgsfield';

// ---------------------------------------------------------------------------
// ARC-004 — interception réseau MSW au lieu de remplacer globalThis.fetch.
//
// Les anciens helpers (mockImageResponse / mockVideoSubmitResponse /
// mockVideoPollResponse / mockHttpError) empilaient des réponses via
// `mockFetch.mockResolvedValueOnce`. Ici on conserve EXACTEMENT cette sémantique
// séquentielle « once » en poussant des producteurs de réponse dans des files
// par-endpoint (imageQueue / videoSubmitQueue / pollQueue) qui sont consommées
// FIFO par des handlers MSW enregistrés une fois par test.
//
// On capture aussi chaque requête (url / method / headers / body) dans `calls`
// pour rejouer les assertions qui lisaient `mockFetch.mock.calls[...]`, et
// `fetchCallCount` remplace `mockFetch.toHaveBeenCalledTimes`.
// ---------------------------------------------------------------------------

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Eliminate real delays: stub the RetryPolicy sleep and adapter sleep
// so every timer-based wait resolves instantly.
// ---------------------------------------------------------------------------

vi.spyOn(RetryPolicy.prototype as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// Captured request log + per-endpoint response queues
// ---------------------------------------------------------------------------

interface CapturedCall {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

/** Réponses séquentielles « once » par type d'endpoint (FIFO). */
type ResponseProducer = () => Response;

let calls: CapturedCall[] = [];
let imageQueue: ResponseProducer[] = [];
let videoSubmitQueue: ResponseProducer[] = [];
let pollQueue: ResponseProducer[] = [];

function fetchCallCount(): number {
  return calls.length;
}

function shiftOrThrow(
  queue: ResponseProducer[],
  label: string,
): Response {
  const producer = queue.shift();
  if (!producer) {
    throw new Error(`MSW: no queued response left for ${label}`);
  }
  return producer();
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'higgsfield-test',
    type: 'higgsfield',
    name: 'Higgsfield Test',
    apiKeyEnvVar: 'TEST_HIGGSFIELD_API_KEY',
    capabilities: ['image', 'video'],
    models: [
      { name: 'hf-image-v1', capability: 'image', costPerUnit: 3 },
      { name: 'hf-video-v1', capability: 'video', costPerUnit: 25 },
    ],
    rateLimitRpm: 30,
    dailyBudgetCents: 500,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxCalls: 1,
    },
    priority: 2,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function buildImageParams(
  overrides: Partial<ImageGenParams> = {},
): ImageGenParams {
  return {
    model: 'hf-image-v1',
    prompt: 'A serene Japanese garden with cherry blossoms',
    ...overrides,
  };
}

function buildVideoParams(
  overrides: Partial<VideoGenParams> = {},
): VideoGenParams {
  return {
    model: 'hf-video-v1',
    prompt: 'A skincare product rotating on a pedestal',
    ...overrides,
  };
}

// --- Helpers: enqueue MSW responses (mêmes signatures qu'avant) -------------

function mockImageResponse(
  images: Array<{ url?: string; base64?: string }>,
): void {
  imageQueue.push(() => HttpResponse.json({ images }));
}

function mockVideoSubmitResponse(jobId: string, status = 'queued'): void {
  videoSubmitQueue.push(() =>
    HttpResponse.json({ job_id: jobId, status }),
  );
}

function mockVideoPollResponse(
  status: string,
  videoUrl?: string,
  error?: string,
): void {
  pollQueue.push(() =>
    HttpResponse.json({
      status,
      ...(videoUrl ? { video_url: videoUrl } : {}),
      ...(error ? { error } : {}),
    }),
  );
}

/** Erreur HTTP générique sur l'endpoint image (submit synchrone). */
function mockHttpError(status: number, body = `Error ${status}`): void {
  imageQueue.push(() => new HttpResponse(body, { status }));
}

/** Erreur HTTP générique sur l'endpoint video submit. */
function mockVideoSubmitHttpError(
  status: number,
  body = `Error ${status}`,
): void {
  videoSubmitQueue.push(() => new HttpResponse(body, { status }));
}

/** Réponse de poll en erreur HTTP (ex: 500 transitoire). */
function mockPollHttpError(status: number, body = `Error ${status}`): void {
  pollQueue.push(() => new HttpResponse(body, { status }));
}

/**
 * Stub the adapter's private sleep so it resolves instantly.
 * Must be called after adapter construction.
 */
function stubAdapterSleep(inst: HiggsFieldAdapter): void {
  vi.spyOn(inst as any, 'sleep').mockResolvedValue(undefined);
}

/**
 * Enregistre les handlers MSW (une fois par test). Ils capturent la requête
 * puis consomment la file FIFO de l'endpoint correspondant, reproduisant la
 * sémantique `mockResolvedValueOnce`.
 */
function registerHandlers(): void {
  server.use(
    http.post(/\/images\/generate$/, async ({ request }) => {
      calls.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.clone().text(),
      });
      return shiftOrThrow(imageQueue, 'POST /images/generate');
    }),
    http.post(/\/videos\/generate$/, async ({ request }) => {
      calls.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await request.clone().text(),
      });
      return shiftOrThrow(videoSubmitQueue, 'POST /videos/generate');
    }),
    http.get(/\/videos\/status\/[^/]+$/, ({ request }) => {
      calls.push({
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: '',
      });
      return shiftOrThrow(pollQueue, 'GET /videos/status/:jobId');
    }),
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('HiggsFieldAdapter', () => {
  let adapter: HiggsFieldAdapter;
  const originalEnv = process.env.TEST_HIGGSFIELD_API_KEY;

  beforeEach(() => {
    process.env.TEST_HIGGSFIELD_API_KEY = 'hf-test-key-xyz';
    calls = [];
    imageQueue = [];
    videoSubmitQueue = [];
    pollQueue = [];
    registerHandlers();
    adapter = new HiggsFieldAdapter(buildConfig());
    stubAdapterSleep(adapter);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TEST_HIGGSFIELD_API_KEY = originalEnv;
    } else {
      delete process.env.TEST_HIGGSFIELD_API_KEY;
    }
  });

  // =========================================================================
  // generateImage
  // =========================================================================

  describe('generateImage', () => {
    it('returns images on 200 OK with single image', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.data.images).toHaveLength(1);
      expect(result.data.images[0]!.url).toBe(
        'https://cdn.higgsfield.ai/img1.png',
      );
    });

    it('returns images on 200 OK with multiple images (count=3)', async () => {
      mockImageResponse([
        { url: 'https://cdn.higgsfield.ai/img1.png' },
        { url: 'https://cdn.higgsfield.ai/img2.png' },
        { url: 'https://cdn.higgsfield.ai/img3.png' },
      ]);

      const result = await adapter.generateImage(
        buildImageParams({ count: 3 }),
      );

      expect(result.data.images).toHaveLength(3);
    });

    it('sends correct Authorization Bearer header', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams());

      expect(calls[0]!.headers.get('Authorization')).toBe(
        'Bearer hf-test-key-xyz',
      );
    });

    it('sends correct Content-Type header', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams());

      expect(calls[0]!.headers.get('Content-Type')).toBe('application/json');
    });

    it('request body includes model, prompt, num_images, width, height', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(
        buildImageParams({ count: 2, width: 512, height: 768 }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body).toMatchObject({
        model: 'hf-image-v1',
        prompt: 'A serene Japanese garden with cherry blossoms',
        num_images: 2,
        width: 512,
        height: 768,
      });
    });

    it('defaults width/height to 1024x1024 when not provided', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams());

      const body = JSON.parse(calls[0]!.body);
      expect(body.width).toBe(1024);
      expect(body.height).toBe(1024);
    });

    it('custom width/height passed correctly', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(
        buildImageParams({ width: 768, height: 1344 }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body.width).toBe(768);
      expect(body.height).toBe(1344);
    });

    it('includes negative_prompt when provided', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(
        buildImageParams({ negativePrompt: 'blurry, low quality' }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body.negative_prompt).toBe('blurry, low quality');
    });

    it('includes quality when provided', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams({ quality: 'hd' }));

      const body = JSON.parse(calls[0]!.body);
      expect(body.quality).toBe('hd');
    });

    it('includes style when provided', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(
        buildImageParams({ style: 'photorealistic' }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body.style).toBe('photorealistic');
    });

    it('uses custom baseUrl from config when provided', async () => {
      const customAdapter = new HiggsFieldAdapter(
        buildConfig({ baseUrl: 'https://custom.hf.internal/v1' }),
      );
      stubAdapterSleep(customAdapter);
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await customAdapter.generateImage(buildImageParams());

      expect(calls[0]!.url).toBe(
        'https://custom.hf.internal/v1/images/generate',
      );
    });

    it('falls back to default BASE_URL when no config.baseUrl', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams());

      expect(calls[0]!.url).toBe(
        'https://api.higgsfield.ai/v1/images/generate',
      );
    });

    it('cost calculated as costPerUnit * count', async () => {
      mockImageResponse([
        { url: 'https://cdn.higgsfield.ai/img1.png' },
        { url: 'https://cdn.higgsfield.ai/img2.png' },
      ]);

      const result = await adapter.generateImage(
        buildImageParams({ count: 2 }),
      );

      // costPerUnit for hf-image-v1 is 3 cents; 3 * 2 = 6
      expect(result.costCents).toBe(6);
    });

    it('cost is 0 when model not found in config', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      const result = await adapter.generateImage(
        buildImageParams({ model: 'nonexistent-model' }),
      );

      expect(result.costCents).toBe(0);
    });

    it('latencyMs is a non-negative number', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });

    it('provider and model fields set correctly in result', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.provider).toBe('Higgsfield Test');
      expect(result.model).toBe('hf-image-v1');
    });

    it('throws ProviderError on 401 (non-retryable)', async () => {
      mockHttpError(401, 'Unauthorized');

      await expect(adapter.generateImage(buildImageParams())).rejects.toThrow(
        ProviderError,
      );
    });

    it('401 error has non-retryable flag and correct statusCode', async () => {
      mockHttpError(401, 'Unauthorized');

      try {
        await adapter.generateImage(buildImageParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(false);
        expect(pe.statusCode).toBe(401);
        expect(pe.message).toContain('401');
        expect(pe.message).toContain('Higgsfield');
      }
    });

    it('throws ProviderError on 403 (non-retryable)', async () => {
      mockHttpError(403, 'Forbidden');

      try {
        await adapter.generateImage(buildImageParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pe = err as ProviderError;
        expect(pe).toBeInstanceOf(ProviderError);
        expect(pe.retryable).toBe(false);
        expect(pe.statusCode).toBe(403);
      }
    });

    it('throws ProviderError on 429 (retryable) after retry exhaustion', async () => {
      // 429 is retryable => retry policy retries 3 times (4 total attempts)
      for (let i = 0; i < 4; i++) {
        mockHttpError(429, 'Rate limited');
      }

      try {
        await adapter.generateImage(buildImageParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pe = err as ProviderError;
        expect(pe).toBeInstanceOf(ProviderError);
        expect(pe.retryable).toBe(true);
        expect(pe.statusCode).toBe(429);
      }
    });

    it('throws ProviderError on 500 (retryable) after retry exhaustion', async () => {
      for (let i = 0; i < 4; i++) {
        mockHttpError(500, 'Internal Server Error');
      }

      try {
        await adapter.generateImage(buildImageParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        const pe = err as ProviderError;
        expect(pe).toBeInstanceOf(ProviderError);
        expect(pe.retryable).toBe(true);
        expect(pe.statusCode).toBe(500);
      }
    });

    it('throws on network failure (e.g. AbortError)', async () => {
      // Réseau qui échoue à chaque tentative (retry policy réessaie les
      // erreurs génériques) — HttpResponse.error() simule un échec réseau.
      for (let i = 0; i < 4; i++) {
        imageQueue.push(() => HttpResponse.error());
      }

      await expect(
        adapter.generateImage(buildImageParams()),
      ).rejects.toThrow();
    });

    it('handles empty images array in response', async () => {
      mockImageResponse([]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.data.images).toEqual([]);
    });

    it('handles base64 images in response', async () => {
      const b64 = 'iVBORw0KGgoAAAANSUhEUg==';
      mockImageResponse([{ base64: b64 }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.data.images[0]!.base64).toBe(b64);
      expect(result.data.images[0]!.url).toBeUndefined();
    });

    it('tokensUsed is zero for image generation', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
    });

    it('does not include negative_prompt, quality, or style when not provided', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await adapter.generateImage(buildImageParams());

      const body = JSON.parse(calls[0]!.body);
      expect(body).not.toHaveProperty('negative_prompt');
      expect(body).not.toHaveProperty('quality');
      expect(body).not.toHaveProperty('style');
    });

    it('strips trailing slash from custom baseUrl', async () => {
      const customAdapter = new HiggsFieldAdapter(
        buildConfig({ baseUrl: 'https://custom.hf.internal/v1/' }),
      );
      stubAdapterSleep(customAdapter);
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);

      await customAdapter.generateImage(buildImageParams());

      expect(calls[0]!.url).toBe(
        'https://custom.hf.internal/v1/images/generate',
      );
    });

    it('throws when API key env var is missing', async () => {
      delete process.env.TEST_HIGGSFIELD_API_KEY;
      const noKeyAdapter = new HiggsFieldAdapter(buildConfig());
      stubAdapterSleep(noKeyAdapter);

      await expect(
        noKeyAdapter.generateImage(buildImageParams()),
      ).rejects.toThrow(/Missing API key/);
    });

    it('retry on transient 500 then succeed', async () => {
      // First attempt: 500, second attempt: success
      mockHttpError(500, 'Transient error');
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/retry-ok.png' }]);

      const result = await adapter.generateImage(buildImageParams());

      expect(result.data.images[0]!.url).toBe(
        'https://cdn.higgsfield.ai/retry-ok.png',
      );
      expect(fetchCallCount()).toBe(2);
    });
  });

  // =========================================================================
  // generateVideo
  // =========================================================================

  describe('generateVideo', () => {
    it('submits video job and returns result after first poll (completed immediately)', async () => {
      mockVideoSubmitResponse('job-001');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-001.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.data.videoUrl).toBe(
        'https://cdn.higgsfield.ai/vid/job-001.mp4',
      );
    });

    it('polls multiple times until completed', async () => {
      mockVideoSubmitResponse('job-002');
      mockVideoPollResponse('queued');
      mockVideoPollResponse('processing');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-002.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.data.videoUrl).toBe(
        'https://cdn.higgsfield.ai/vid/job-002.mp4',
      );
      // 1 submit + 3 polls = 4 fetch calls
      expect(fetchCallCount()).toBe(4);
    });

    it('sends correct request body (model, prompt, duration_seconds)', async () => {
      mockVideoSubmitResponse('job-003');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-003.mp4',
      );

      await adapter.generateVideo(
        buildVideoParams({ durationSeconds: 10 }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body).toMatchObject({
        model: 'hf-video-v1',
        prompt: 'A skincare product rotating on a pedestal',
        duration_seconds: 10,
      });
    });

    it('defaults duration to 5s when not provided', async () => {
      mockVideoSubmitResponse('job-004');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-004.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      const body = JSON.parse(calls[0]!.body);
      expect(body.duration_seconds).toBe(5);
    });

    it('includes image_url in submit body when imageUrl provided', async () => {
      mockVideoSubmitResponse('job-005');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-005.mp4',
      );

      await adapter.generateVideo(
        buildVideoParams({ imageUrl: 'https://example.com/ref.jpg' }),
      );

      const body = JSON.parse(calls[0]!.body);
      expect(body.image_url).toBe('https://example.com/ref.jpg');
    });

    it('returns video URL from completed status', async () => {
      const url = 'https://cdn.higgsfield.ai/vid/unique.mp4';
      mockVideoSubmitResponse('job-006');
      mockVideoPollResponse('completed', url);

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.data.videoUrl).toBe(url);
    });

    it('throws ProviderError on failed status (non-retryable)', async () => {
      mockVideoSubmitResponse('job-007');
      mockVideoPollResponse('failed', undefined, 'Content policy violation');

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(false);
        expect(pe.message).toContain('failed');
        expect(pe.message).toContain('Content policy violation');
      }
    });

    it('throws ProviderError on poll timeout (retryable)', async () => {
      mockVideoSubmitResponse('job-008');
      // Provide submit mocks for all retry attempts (4 total: 1 + 3 retries)
      mockVideoSubmitResponse('job-008');
      mockVideoSubmitResponse('job-008');
      mockVideoSubmitResponse('job-008');

      // Spy on pollVideoStatus to always reject with timeout error.
      // Must use mockRejectedValue (not Once) to cover all retry attempts.
      vi.spyOn(adapter as any, 'pollVideoStatus').mockRejectedValue(
        new ProviderError(
          'Higgsfield video generation timed out after 300000ms for job job-008',
          { provider: 'Higgsfield Test', model: 'hf-video-v1', retryable: true },
        ),
      );

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(true);
        expect(pe.message).toContain('timed out');
        expect(pe.message).toContain('job-008');
      }
    });

    it('handles transient 500 during polling (continues polling)', async () => {
      mockVideoSubmitResponse('job-009');
      // First poll: 500 (transient -- continues polling)
      mockPollHttpError(500, 'Server Error');
      // Second poll: completed
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-009.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.data.videoUrl).toBe(
        'https://cdn.higgsfield.ai/vid/job-009.mp4',
      );
    });

    it('throws on 401 during submit (non-retryable)', async () => {
      mockVideoSubmitHttpError(401, 'Unauthorized');

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(false);
        expect(pe.statusCode).toBe(401);
      }
    });

    it('throws on 429 during submit (retryable) after retry exhaustion', async () => {
      for (let i = 0; i < 4; i++) {
        mockVideoSubmitHttpError(429, 'Rate limited');
      }

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(true);
        expect(pe.statusCode).toBe(429);
      }
    });

    it('cost calculated correctly for video', async () => {
      mockVideoSubmitResponse('job-010');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-010.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      // hf-video-v1 costPerUnit = 25
      expect(result.costCents).toBe(25);
    });

    it('cost is 0 when video model not found in config', async () => {
      mockVideoSubmitResponse('job-cost-0');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-cost-0.mp4',
      );

      const result = await adapter.generateVideo(
        buildVideoParams({ model: 'nonexistent-video-model' }),
      );

      expect(result.costCents).toBe(0);
    });

    it('job ID extracted from submit response and used in poll URL', async () => {
      mockVideoSubmitResponse('unique-job-42');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/out.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      // The poll URL should contain the job ID
      expect(calls[1]!.url).toContain('/videos/status/unique-job-42');
    });

    it('unknown poll status continues polling', async () => {
      mockVideoSubmitResponse('job-unknown');
      mockVideoPollResponse('initializing'); // unknown status
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-unknown.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.data.videoUrl).toBe(
        'https://cdn.higgsfield.ai/vid/job-unknown.mp4',
      );
      // 1 submit + 2 polls = 3 calls
      expect(fetchCallCount()).toBe(3);
    });

    it('submit URL is correct', async () => {
      mockVideoSubmitResponse('job-url');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-url.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      expect(calls[0]!.url).toBe(
        'https://api.higgsfield.ai/v1/videos/generate',
      );
    });

    it('submit sends correct headers', async () => {
      mockVideoSubmitResponse('job-hdr');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-hdr.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      expect(calls[0]!.headers.get('Authorization')).toBe(
        'Bearer hf-test-key-xyz',
      );
      expect(calls[0]!.headers.get('Content-Type')).toBe('application/json');
    });

    it('poll sends Authorization header', async () => {
      mockVideoSubmitResponse('job-poll-hdr');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-poll-hdr.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      expect(calls[1]!.headers.get('Authorization')).toBe(
        'Bearer hf-test-key-xyz',
      );
    });

    it('provider and model set correctly in video result', async () => {
      mockVideoSubmitResponse('job-meta');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-meta.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.provider).toBe('Higgsfield Test');
      expect(result.model).toBe('hf-video-v1');
    });

    it('latencyMs is a non-negative number for video', async () => {
      mockVideoSubmitResponse('job-lat');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-lat.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });

    it('throws when completed but no video_url returned', async () => {
      mockVideoSubmitResponse('job-no-url');
      // completed but no video_url
      pollQueue.push(() => HttpResponse.json({ status: 'completed' }));

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(false);
        expect(pe.message).toContain('no video_url');
      }
    });

    it('throws when API key env var is missing for video', async () => {
      delete process.env.TEST_HIGGSFIELD_API_KEY;
      const noKeyAdapter = new HiggsFieldAdapter(buildConfig());
      stubAdapterSleep(noKeyAdapter);

      await expect(
        noKeyAdapter.generateVideo(buildVideoParams()),
      ).rejects.toThrow(/Missing API key/);
    });

    it('submit succeeds but all polls fail with 500 until timeout', async () => {
      mockVideoSubmitResponse('job-all-fail');
      // Provide submit mocks for all retry attempts
      mockVideoSubmitResponse('job-all-fail');
      mockVideoSubmitResponse('job-all-fail');
      mockVideoSubmitResponse('job-all-fail');

      vi.spyOn(adapter as any, 'pollVideoStatus').mockRejectedValue(
        new ProviderError(
          'Higgsfield video generation timed out after 300000ms for job job-all-fail',
          { provider: 'Higgsfield Test', model: 'hf-video-v1', retryable: true },
        ),
      );

      try {
        await adapter.generateVideo(buildVideoParams());
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderError);
        const pe = err as ProviderError;
        expect(pe.retryable).toBe(true);
        expect(pe.message).toContain('timed out');
      }
    });

    it('does not include image_url when imageUrl is not provided', async () => {
      mockVideoSubmitResponse('job-no-img');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-no-img.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      const body = JSON.parse(calls[0]!.body);
      expect(body).not.toHaveProperty('image_url');
    });

    it('tokensUsed is zero for video generation', async () => {
      mockVideoSubmitResponse('job-tok');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-tok.mp4',
      );

      const result = await adapter.generateVideo(buildVideoParams());

      expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
    });
  });

  // =========================================================================
  // Unsupported operations
  // =========================================================================

  describe('unsupported operations', () => {
    it('generateText throws NotImplementedError', async () => {
      const params: TextGenParams = {
        model: 'hf-text',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(adapter.generateText(params)).rejects.toThrow(
        NotImplementedError,
      );
    });

    it('generateEmbedding throws NotImplementedError', async () => {
      const params: EmbeddingParams = {
        model: 'hf-embed',
        input: 'some text',
      };

      await expect(adapter.generateEmbedding(params)).rejects.toThrow(
        NotImplementedError,
      );
    });

    it('generateText error message includes "Higgsfield"', async () => {
      const params: TextGenParams = {
        model: 'hf-text',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(adapter.generateText(params)).rejects.toThrow(
        /Higgsfield/,
      );
    });

    it('generateEmbedding error message includes "Higgsfield"', async () => {
      const params: EmbeddingParams = {
        model: 'hf-embed',
        input: 'some text',
      };

      await expect(adapter.generateEmbedding(params)).rejects.toThrow(
        /Higgsfield/,
      );
    });

    it('generateText error includes operation name', async () => {
      const params: TextGenParams = {
        model: 'hf-text',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(adapter.generateText(params)).rejects.toThrow(
        /generateText/,
      );
    });

    it('generateEmbedding error includes operation name', async () => {
      const params: EmbeddingParams = {
        model: 'hf-embed',
        input: 'some text',
      };

      await expect(adapter.generateEmbedding(params)).rejects.toThrow(
        /generateEmbedding/,
      );
    });
  });

  // =========================================================================
  // Circuit breaker integration
  // =========================================================================

  describe('circuit breaker integration', () => {
    it('after N consecutive failures the circuit opens', async () => {
      // failureThreshold=5. Non-retryable 401 avoids retry delays.
      for (let i = 0; i < 5; i++) {
        mockHttpError(401, 'Unauthorized');
        try {
          await adapter.generateImage(buildImageParams());
        } catch {
          // expected
        }
      }

      const cb = (adapter as unknown as Record<string, unknown>)
        .circuitBreaker as { getState: () => string };
      expect(cb.getState()).toBe('OPEN');
    });

    it('open circuit rejects immediately without API call', async () => {
      for (let i = 0; i < 5; i++) {
        mockHttpError(401, 'Unauthorized');
        try {
          await adapter.generateImage(buildImageParams());
        } catch {
          // expected
        }
      }

      const callsBefore = fetchCallCount();

      await expect(
        adapter.generateImage(buildImageParams()),
      ).rejects.toThrow(ProviderError);

      // No additional fetch calls should have been made
      expect(fetchCallCount()).toBe(callsBefore);
    });

    it('half-open circuit allows one trial call after reset timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const cbAdapter = new HiggsFieldAdapter(buildConfig());
      stubAdapterSleep(cbAdapter);

      for (let i = 0; i < 5; i++) {
        mockHttpError(401, 'Unauthorized');
        try {
          await cbAdapter.generateImage(buildImageParams());
        } catch {
          // expected
        }
      }

      // Advance time past resetTimeoutMs (60000ms)
      vi.advanceTimersByTime(61_000);

      const cb = (cbAdapter as unknown as Record<string, unknown>)
        .circuitBreaker as { getState: () => string };
      expect(cb.getState()).toBe('HALF_OPEN');

      vi.useRealTimers();
    });

    it('successful trial closes the circuit', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const cbAdapter = new HiggsFieldAdapter(buildConfig());
      stubAdapterSleep(cbAdapter);

      for (let i = 0; i < 5; i++) {
        mockHttpError(401, 'Unauthorized');
        try {
          await cbAdapter.generateImage(buildImageParams());
        } catch {
          // expected
        }
      }

      vi.advanceTimersByTime(61_000);

      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);
      const result = await cbAdapter.generateImage(buildImageParams());

      expect(result.data.images).toHaveLength(1);

      const cb = (cbAdapter as unknown as Record<string, unknown>)
        .circuitBreaker as { getState: () => string };
      expect(cb.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });

    it('failed trial re-opens the circuit', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const cbAdapter = new HiggsFieldAdapter(buildConfig());
      stubAdapterSleep(cbAdapter);

      for (let i = 0; i < 5; i++) {
        mockHttpError(401, 'Unauthorized');
        try {
          await cbAdapter.generateImage(buildImageParams());
        } catch {
          // expected
        }
      }

      vi.advanceTimersByTime(61_000);

      mockHttpError(401, 'Still broken');
      try {
        await cbAdapter.generateImage(buildImageParams());
      } catch {
        // expected
      }

      const cb = (cbAdapter as unknown as Record<string, unknown>)
        .circuitBreaker as { getState: () => string };
      expect(cb.getState()).toBe('OPEN');

      vi.useRealTimers();
    });
  });

  // =========================================================================
  // Adapter metadata
  // =========================================================================

  describe('adapter metadata', () => {
    it('name returns config name', () => {
      expect(adapter.name).toBe('Higgsfield Test');
    });

    it('capabilities returns config capabilities', () => {
      expect(adapter.capabilities).toContain('image');
      expect(adapter.capabilities).toContain('video');
    });

    it('lastCostCents starts at 0', () => {
      expect(adapter.lastCostCents).toBe(0);
    });

    it('lastCostCents updates after generateImage', async () => {
      mockImageResponse([{ url: 'https://cdn.higgsfield.ai/img1.png' }]);
      await adapter.generateImage(buildImageParams({ count: 2 }));

      // 3 cents * 2 = 6
      expect(adapter.lastCostCents).toBe(6);
    });

    it('lastCostCents updates after generateVideo', async () => {
      mockVideoSubmitResponse('job-cost');
      mockVideoPollResponse(
        'completed',
        'https://cdn.higgsfield.ai/vid/job-cost.mp4',
      );

      await adapter.generateVideo(buildVideoParams());

      expect(adapter.lastCostCents).toBe(25);
    });
  });
});
