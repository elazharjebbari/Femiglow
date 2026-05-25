import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock getEngineConfig before importing the module under test
vi.mock('../config', () => ({
  getEngineConfig: () => ({
    enabled: true,
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    providers: {
      text: { default: 'openai', model: 'gpt-4' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {},
  }),
}));

import { parseBriefNode } from './parse-brief';

describe('parseBriefNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a valid brief input', async () => {
    const state = {
      jobId: 'job-123',
      briefInput: {
        objective: 'awareness',
        keyMessage: 'Discover the ritual of natural beauty.',
        tone: 'luxurious',
        language: 'en',
        maxBudgetCents: 50,
      },
    };

    const result = await parseBriefNode(state);

    expect(result.brief).toBeDefined();
    expect((result.brief as Record<string, unknown>).objective).toBe('awareness');
    expect((result.brief as Record<string, unknown>).keyMessage).toBe(
      'Discover the ritual of natural beauty.',
    );
    expect(result.currentStep).toBe('parse_brief');
  });

  it('applies default tone from config when not in brief', async () => {
    const state = {
      jobId: 'job-456',
      briefInput: {
        objective: 'engagement',
        keyMessage: 'A beautiful message.',
      },
    };

    const result = await parseBriefNode(state);
    const brief = result.brief as Record<string, unknown>;

    expect(brief.tone).toBe('professional');
  });

  it('applies default language from config when not in brief', async () => {
    const state = {
      jobId: 'job-789',
      briefInput: {
        objective: 'conversion',
        keyMessage: 'Convert now.',
      },
    };

    const result = await parseBriefNode(state);
    const brief = result.brief as Record<string, unknown>;

    expect(brief.language).toBe('fr');
  });

  it('validates objective enum — rejects invalid value', async () => {
    const state = {
      jobId: 'job-bad',
      briefInput: {
        objective: 'invalid_objective',
        keyMessage: 'Test message.',
      },
    };

    await expect(parseBriefNode(state)).rejects.toThrow();
  });

  it('returns costTracking with budgetRemainingCents', async () => {
    const state = {
      jobId: 'job-cost',
      briefInput: {
        objective: 'education',
        keyMessage: 'Learn the ritual.',
        maxBudgetCents: 75,
      },
    };

    const result = await parseBriefNode(state);
    const cost = result.costTracking as Record<string, unknown>;

    expect(cost).toBeDefined();
    expect(cost.totalCents).toBe(0);
    expect(cost.budgetRemainingCents).toBe(75);
    expect(cost.breakdown).toEqual({});
    expect(cost.tokensUsed).toEqual({});
  });

  it('uses config budget when maxBudgetCents is not provided', async () => {
    const state = {
      jobId: 'job-default-budget',
      briefInput: {
        objective: 'entertainment',
        keyMessage: 'Fun content.',
      },
    };

    const result = await parseBriefNode(state);
    const cost = result.costTracking as Record<string, unknown>;

    // Config maxPerJobCents is 200
    expect(cost.budgetRemainingCents).toBe(200);
  });

  it('applies defaults for targetAudience and constraints', async () => {
    const state = {
      jobId: 'job-defaults',
      briefInput: {
        objective: 'awareness',
        keyMessage: 'Beautiful nails.',
      },
    };

    const result = await parseBriefNode(state);
    const brief = result.brief as Record<string, unknown>;

    expect(brief.targetAudience).toBe('Femmes 25-45 ans intéressées par la beauté japonaise');
    expect(brief.constraints).toEqual([]);
  });

  it('reads from state.brief when state.briefInput is absent', async () => {
    const state = {
      jobId: 'job-alt',
      brief: {
        objective: 'engagement',
        keyMessage: 'Engage with our brand.',
        tone: 'casual',
      },
    };

    const result = await parseBriefNode(state);
    const brief = result.brief as Record<string, unknown>;

    expect(brief.objective).toBe('engagement');
    expect(brief.tone).toBe('casual');
  });
});
