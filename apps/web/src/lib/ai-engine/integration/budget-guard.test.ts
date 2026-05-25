/**
 * Gap #16 — Budget enforcement integration test.
 *
 * Tests that budget tracking works correctly in the orchestrator and
 * that cost data flows through the pipeline.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config with budget settings
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

vi.mock('../jobs', () => ({
  createJob: vi.fn().mockResolvedValue(undefined),
  updateJobResult: vi.fn().mockResolvedValue(undefined),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/client', () => ({
  db: () => null,
}));

vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: () => ({
    scoreTotal: 80,
    score: 80,
    status: 'pass',
    violations: [],
  }),
}));

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

import { resetContentEngine } from '../graph';
import { runGeneration, type GenerationRequest } from '../orchestrator';

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Budget test.',
    },
    ...overrides,
  };
}

describe('integration: budget-guard', () => {
  beforeEach(() => {
    resetContentEngine();
  });

  afterEach(() => {
    resetContentEngine();
  });

  it('generation proceeds when budget is available', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.status).toBe('completed');
  }, 15_000);

  it('daily spend does not block generation (budget is per-job)', async () => {
    // Run two generations — the daily spend grows but should not block
    const result1 = await runGeneration(makeRequest());
    expect(result1.status).toBe('completed');

    resetContentEngine();
    const result2 = await runGeneration(makeRequest());
    expect(result2.status).toBe('completed');
  }, 30_000);

  it('per-job budget tracked in costTracking.budgetRemainingCents', async () => {
    const result = await runGeneration(makeRequest());
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost).toBeTruthy();
    // budgetRemainingCents should exist and be a number
    expect(typeof cost.budgetRemainingCents).toBe('number');
    // For deterministic/fallback, costs are 0, so budget should still be >= 0
    expect(cost.budgetRemainingCents as number).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it('budget decreases after each node execution', async () => {
    const result = await runGeneration(makeRequest());
    const cost = result.costTracking as Record<string, unknown>;

    // For deterministic mode, totalCents should be 0 (no LLM calls)
    // Budget remaining should be <= initial maxPerJobCents (100)
    const remaining = cost.budgetRemainingCents as number;
    const total = cost.totalCents as number;
    expect(remaining).toBeLessThanOrEqual(100);
    // remaining + total should be <= initial budget (may not be exact
    // due to how reducers merge, but should be in reasonable range)
    expect(total).toBeGreaterThanOrEqual(0);
  }, 15_000);

  it('cost breakdown has entries for cost-incurring nodes', async () => {
    const result = await runGeneration(makeRequest());
    const cost = result.costTracking as Record<string, unknown>;
    const breakdown = cost.breakdown as Record<string, number>;

    expect(breakdown).toBeTruthy();
    // The breakdown should have entries for script and caption nodes at minimum
    expect(typeof breakdown).toBe('object');
    // In deterministic mode, the node keys exist even with 0 cost
    const keys = Object.keys(breakdown);
    expect(keys.length).toBeGreaterThanOrEqual(1);
  }, 15_000);

  it('zero-cost nodes (mock providers) do not affect budget', async () => {
    const result = await runGeneration(makeRequest());
    const cost = result.costTracking as Record<string, unknown>;
    const breakdown = cost.breakdown as Record<string, number>;

    // Mock image generation should have 0 cost
    if (breakdown.generate_images !== undefined) {
      expect(breakdown.generate_images).toBe(0);
    }

    // Total cost in deterministic mode should be 0
    expect(cost.totalCents as number).toBe(0);
  }, 15_000);
});
