/**
 * Concurrent generation safety tests — Gap #17
 *
 * Validates that multiple simultaneous generation calls do not interfere
 * with each other's state, cost tracking, or error handling.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const invokeCallArgs: Array<Record<string, unknown>> = [];

vi.mock('./graph', () => {
  const mockInvoke = vi.fn().mockImplementation(async (state: Record<string, unknown>) => {
    invokeCallArgs.push(state);
    // Simulate some async work
    await new Promise((r) => setTimeout(r, 10));
    return {
      ...state,
      caption: `Generated for job ${state.jobId}`,
      hashtags: ['#beauty'],
      script: { hook: 'Hook', scenes: [], cta: 'CTA' },
      qualityScores: { average: 0.85 },
      moderationResult: { safe: true },
      costTracking: {
        totalCents: 10,
        breakdown: { text: 5, image: 5 },
        tokensUsed: { text: 200 },
      },
      errors: [],
      currentStep: 'done',
      humanReview: { decision: 'approved_direct' },
    };
  });
  const mockGetState = vi.fn().mockResolvedValue({ next: [], tasks: [] });
  return {
    getContentEngine: () => ({
      invoke: mockInvoke,
      getState: mockGetState,
    }),
    resetContentEngine: vi.fn(),
  };
});

vi.mock('./config', () => ({
  getEngineConfig: vi.fn(() => ({
    enabled: true,
    providers: { text: { default: 'openai', model: 'gpt-4' }, image: { default: 'mock', model: 'mock' }, video: { default: 'mock' }, tts: { default: 'mock' } },
    apiKeys: {},
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  })),
}));

vi.mock('./jobs', () => ({
  createJob: vi.fn().mockResolvedValue(undefined),
  updateJobResult: vi.fn().mockResolvedValue(undefined),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
}));

import { runGeneration, type GenerationRequest } from './orchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(keyMessage: string): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Concurrent generation safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeCallArgs.length = 0;
  });

  it('two runGeneration calls with different messages do not interfere', async () => {
    const [result1, result2] = await Promise.all([
      runGeneration(makeRequest('Message A')),
      runGeneration(makeRequest('Message B')),
    ]);

    expect(result1.jobId).not.toBe(result2.jobId);
    expect(result1.status).toBe('completed');
    expect(result2.status).toBe('completed');
  });

  it('each call gets a unique UUID jobId', async () => {
    const results = await Promise.all([
      runGeneration(makeRequest('Test 1')),
      runGeneration(makeRequest('Test 2')),
      runGeneration(makeRequest('Test 3')),
    ]);

    const jobIds = results.map((r) => r.jobId);
    const uniqueIds = new Set(jobIds);
    expect(uniqueIds.size).toBe(3);

    for (const id of jobIds) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it('cost tracking is independent between calls', async () => {
    const [result1, result2] = await Promise.all([
      runGeneration(makeRequest('Cost test A')),
      runGeneration(makeRequest('Cost test B')),
    ]);

    // Each result should have its own cost tracking
    const cost1 = result1.costTracking as Record<string, unknown>;
    const cost2 = result2.costTracking as Record<string, unknown>;

    expect(cost1.totalCents).toBe(10);
    expect(cost2.totalCents).toBe(10);
    // They should be separate object references
    expect(cost1).not.toBe(cost2);
  });

  it('MemorySaver handles concurrent thread_ids', async () => {
    const [result1, result2] = await Promise.all([
      runGeneration(makeRequest('Thread A')),
      runGeneration(makeRequest('Thread B')),
    ]);

    // Both calls should have passed their unique jobId as thread_id to invoke
    expect(invokeCallArgs.length).toBe(2);

    const jobIds = invokeCallArgs.map((args) => args.jobId);
    expect(new Set(jobIds).size).toBe(2);
  });

  it('errors in one generation do not affect the other', async () => {
    const { getContentEngine } = await import('./graph');
    const engine = getContentEngine();
    const invoke = engine.invoke as ReturnType<typeof vi.fn>;

    // First call succeeds, second call fails
    let callCount = 0;
    invoke.mockImplementation(async (state: Record<string, unknown>) => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Provider timeout for call 2');
      }
      return {
        ...state,
        caption: 'Success',
        hashtags: [],
        script: null,
        qualityScores: { average: 0.9 },
        moderationResult: { safe: true },
        costTracking: { totalCents: 5, breakdown: {}, tokensUsed: {} },
        errors: [],
        currentStep: 'done',
        humanReview: { decision: 'approved_direct' },
      };
    });

    const [result1, result2] = await Promise.all([
      runGeneration(makeRequest('Success path')),
      runGeneration(makeRequest('Failure path')),
    ]);

    // One succeeds, one fails — they don't interfere
    const statuses = [result1.status, result2.status].sort();
    expect(statuses).toEqual(['completed', 'failed']);
  });

  it('both calls complete successfully in parallel', async () => {
    const results = await Promise.all([
      runGeneration(makeRequest('Parallel A')),
      runGeneration(makeRequest('Parallel B')),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.status).toBe('completed');
      expect(result.jobId).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
