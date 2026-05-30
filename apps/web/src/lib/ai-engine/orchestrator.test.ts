import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock final state returned by the graph engine
// ---------------------------------------------------------------------------
const mockFinalState: Record<string, unknown> = {
  jobId: 'test-job-id',
  script: { hook: 'Discover our secret', body: 'A beautiful ritual', cta: 'Shop now' },
  caption: 'Unlock the secret of Japanese beauty',
  hashtags: ['#beauty', '#skincare', '#femiglow'],
  images: [{ url: 'https://example.com/image.jpg', provider: 'openai' }],
  videos: [],
  qualityScores: { average: 0.85, coherence: 0.9, brandAlignment: 0.8 },
  moderationResult: { safe: true },
  costTracking: { totalCents: 12, breakdown: {}, tokensUsed: {} },
  errors: [],
  currentStep: 'generateVariants',
};

// ---------------------------------------------------------------------------
// Interrupted graph state (for review tests)
// ---------------------------------------------------------------------------
const mockInterruptedSnapshot = {
  next: ['reviewGate'],
  tasks: [],
  values: { ...mockFinalState, currentStep: 'reviewGate' },
};

const mockCompletedSnapshot = {
  next: [],
  tasks: [],
  values: mockFinalState,
};

// ---------------------------------------------------------------------------
// Mock config
// ---------------------------------------------------------------------------
const mockConfig = {
  enabled: true,
  providers: {
    text: { default: 'openai', model: 'gpt-4' },
    image: { default: 'mock', model: 'mock' },
    video: { default: 'mock' },
    tts: { default: 'mock' },
  },
  apiKeys: {},
  budget: { dailyCents: 1000, maxPerJobCents: 200 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockInvoke = vi.fn().mockResolvedValue(mockFinalState);
const mockGetState = vi.fn().mockResolvedValue(mockCompletedSnapshot);

vi.mock('./graph', () => ({
  getContentEngine: () => ({
    invoke: mockInvoke,
    getState: mockGetState,
  }),
}));

const mockCreateJob = vi.fn().mockResolvedValue(undefined);
const mockUpdateJobResult = vi.fn().mockResolvedValue(undefined);
const mockUpdateJobStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('./jobs', () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
  updateJobResult: (...args: unknown[]) => mockUpdateJobResult(...args),
  updateJobStatus: (...args: unknown[]) => mockUpdateJobStatus(...args),
}));

let configEnabled = true;
vi.mock('./config', () => ({
  getEngineConfig: () => ({
    ...mockConfig,
    enabled: configEnabled,
  }),
}));

import { runGeneration, type GenerationRequest } from './orchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Discover the ritual of Japanese beauty.',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('orchestrator – runGeneration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    configEnabled = true;
    mockInvoke.mockResolvedValue(mockFinalState);
    mockGetState.mockResolvedValue(mockCompletedSnapshot);
    mockCreateJob.mockResolvedValue(undefined);
    mockUpdateJobResult.mockResolvedValue(undefined);
    mockUpdateJobStatus.mockResolvedValue(undefined);
  });

  it('returns completed status on success', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.status).toBe('completed');
  });

  it('returns jobId in UUID format', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('calls createJob with jobId', async () => {
    const result = await runGeneration(makeRequest());
    expect(mockCreateJob).toHaveBeenCalledWith(result.jobId, expect.any(Object));
  });

  it('calls updateJobResult on success', async () => {
    const result = await runGeneration(makeRequest());
    expect(mockUpdateJobResult).toHaveBeenCalledWith(
      result.jobId,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('returns failed status on engine error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('LLM API timeout'));
    const result = await runGeneration(makeRequest());
    expect(result.status).toBe('failed');
  });

  it('returns failed with error message', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('LLM API timeout'));
    const result = await runGeneration(makeRequest());
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as Record<string, unknown>).message).toContain('LLM API timeout');
  });

  it('tracks durationMs', async () => {
    const result = await runGeneration(makeRequest());
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns script from final state', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.script).toEqual(mockFinalState.script);
  });

  it('returns caption from final state', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.caption).toBe('Unlock the secret of Japanese beauty');
  });

  it('returns hashtags from final state', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.hashtags).toEqual(['#beauty', '#skincare', '#femiglow']);
  });

  it('returns images array', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.images).toHaveLength(1);
    expect((result.images[0] as Record<string, unknown>).url).toBe('https://example.com/image.jpg');
  });

  it('returns qualityScores', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.qualityScores).toEqual(mockFinalState.qualityScores);
  });

  it('returns costTracking', async () => {
    const result = await runGeneration(makeRequest());
    expect(result.costTracking).toEqual(mockFinalState.costTracking);
  });

  it('throws when engine is disabled', async () => {
    configEnabled = false;
    await expect(runGeneration(makeRequest())).rejects.toThrow('AI Engine is disabled');
  });

  it('handles review status (interrupted graph)', async () => {
    mockGetState.mockResolvedValueOnce(mockInterruptedSnapshot);

    const result = await runGeneration(makeRequest());
    expect(result.status).toBe('review');
    expect(result.reviewPayload).toBeDefined();
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(expect.any(String), 'review');
  });
});
