/**
 * Gap #11 — Full LangGraph pipeline integration test.
 *
 * Runs the REAL pipeline with deterministic fallback mode (no API keys).
 * All nodes fall back to templates, giving us a genuine integration test
 * at zero cost.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config — no API keys → forces deterministic fallback in every node
// ---------------------------------------------------------------------------
vi.mock('../config', () => ({
  getEngineConfig: () => ({
    enabled: true,
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    budget: { dailyCents: 1000, maxPerJobCents: 100 },
    quality: { threshold: 0.5, humanReviewRequired: false },
    providers: {
      text: { default: 'openai', model: 'gpt-4o-mini' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {
      openai: undefined,
      anthropic: undefined,
      google: undefined,
      elevenlabs: undefined,
    },
  }),
}));

// Mock DB so jobs module does not hit real database
vi.mock('../jobs', () => ({
  createJob: vi.fn().mockResolvedValue(undefined),
  updateJobResult: vi.fn().mockResolvedValue(undefined),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
}));

// Mock the DB client used by knowledge retrieval
vi.mock('@/lib/db/client', () => ({
  db: () => null,
}));

// Mock brand-rules used by quality-check and moderate
vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: () => ({
    scoreTotal: 80,
    score: 80,
    status: 'pass',
    violations: [],
  }),
}));

// Mock compose & transcode file-system operations (sharp, ffmpeg)
vi.mock('sharp', () => {
  const fn = () => ({
    resize: () => fn(),
    jpeg: () => fn(),
    toBuffer: () => Promise.resolve(Buffer.from('mock-image')),
  });
  return { default: fn };
});

vi.mock('fluent-ffmpeg', () => {
  const cmd = () => ({
    input: () => cmd(),
    videoCodec: () => cmd(),
    audioCodec: () => cmd(),
    size: () => cmd(),
    outputOptions: () => cmd(),
    complexFilter: () => cmd(),
    seekInput: () => cmd(),
    frames: () => cmd(),
    save: () => cmd(),
    on: (_: string, cb: () => void) => {
      if (_ === 'end') setTimeout(cb, 0);
      return cmd();
    },
  });
  return { default: cmd };
});

vi.mock('ffmpeg-static', () => ({ default: null }));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock-file')),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
  };
});

// Reset the graph singleton between tests
import { resetContentEngine } from '../graph';
import { runGeneration, type GenerationRequest } from '../orchestrator';

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Discover the ritual of Japanese nail beauty.',
    },
    ...overrides,
  };
}

describe('integration: pipeline-real (deterministic fallback)', () => {
  beforeEach(() => {
    resetContentEngine();
  });

  afterEach(() => {
    resetContentEngine();
  });

  it('runGeneration with format=post returns completed status', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.status).toBe('completed');
  }, 15_000);

  it('result has non-empty script with hook and scenes', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.script).toBeTruthy();
    const script = result.script as Record<string, unknown>;
    expect(script.hook).toBeTruthy();
    expect(typeof script.hook).toBe('string');
    expect(Array.isArray(script.scenes)).toBe(true);
    expect((script.scenes as unknown[]).length).toBeGreaterThan(0);
  }, 15_000);

  it('result has non-empty caption', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.caption).toBeTruthy();
    expect(typeof result.caption).toBe('string');
    expect(result.caption.length).toBeGreaterThan(10);
  }, 15_000);

  it('result has hashtags array', async () => {
    const result = await runGeneration(makeRequest());
    expect(Array.isArray(result.hashtags)).toBe(true);
    expect(result.hashtags.length).toBeGreaterThan(0);
  }, 15_000);

  it('result has images array (mock)', async () => {
    const result = await runGeneration(makeRequest());
    expect(Array.isArray(result.images)).toBe(true);
    expect(result.images.length).toBeGreaterThan(0);
    const firstImage = result.images[0] as Record<string, unknown>;
    expect(firstImage.provider).toContain('mock');
  }, 15_000);

  it('result has qualityScores with average > 0', async () => {
    const result = await runGeneration(makeRequest());
    const scores = result.qualityScores as Record<string, number>;
    expect(scores).toBeTruthy();
    expect(typeof scores.average).toBe('number');
    expect(scores.average).toBeGreaterThan(0);
  }, 15_000);

  it('result has costTracking with totalCents >= 0', async () => {
    const result = await runGeneration(makeRequest());
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost).toBeTruthy();
    expect(typeof cost.totalCents).toBe('number');
    expect(cost.totalCents as number).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it('durationMs is reasonable (< 10s for deterministic)', async () => {
    const result = await runGeneration(makeRequest());
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeLessThan(10_000);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  }, 15_000);
});
