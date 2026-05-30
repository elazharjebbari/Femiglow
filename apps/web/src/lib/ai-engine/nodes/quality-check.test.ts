import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: () => ({ status: 'pass', scoreTotal: 85, violations: [] }),
}));

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

import { qualityCheckNode } from './quality-check';

describe('qualityCheckNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns scores for text_quality, visual_quality, brand_compliance, hook_strength, and average', async () => {
    const state = {
      jobId: 'job-q1',
      caption: 'Un geste lent pour des ongles soignés. Le rituel FemiGlow révèle votre éclat naturel, sans vernis ni abrasion.',
      script: { hook: 'Un geste lent qui change tout dans votre rituel quotidien' },
      hashtags: ['femiglow', 'rituel', 'beaute', 'soin'],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const result = await qualityCheckNode(state);
    const scores = result.qualityScores as Record<string, number>;

    expect(scores).toHaveProperty('text_quality');
    expect(scores).toHaveProperty('visual_quality');
    expect(scores).toHaveProperty('brand_compliance');
    expect(scores).toHaveProperty('hook_strength');
    expect(scores).toHaveProperty('average');
  });

  it('all scores are between 0 and 1', async () => {
    const state = {
      jobId: 'job-q2',
      caption: 'Prendre soin de ses ongles, un geste simple et beau.\nLe rituel FemiGlow révèle l\'éclat naturel.',
      script: { hook: 'Pourquoi ce geste change tout' },
      hashtags: ['femiglow', 'soin', 'rituel', 'beaute', 'eclat'],
      images: [{ provider: 'openai', url: 'https://example.com/img.png' }],
      videos: [],
      format: 'post',
      retries: {},
    };

    const result = await qualityCheckNode(state);
    const scores = result.qualityScores as Record<string, number>;

    for (const [key, value] of Object.entries(scores)) {
      expect(value, `${key} should be >= 0`).toBeGreaterThanOrEqual(0);
      expect(value, `${key} should be <= 1`).toBeLessThanOrEqual(1);
    }
  });

  it('caption with good content scores higher than empty caption', async () => {
    const goodState = {
      jobId: 'job-good',
      caption: 'Prendre soin de ses ongles, un geste simple et beau.\nLe rituel révèle l\'éclat naturel, sans vernis ni abrasion. Découvrez la beauté japonaise authentique.',
      script: { hook: 'Un geste lent qui change tout dans votre rituel quotidien' },
      hashtags: ['femiglow', 'soin', 'rituel', 'beaute', 'eclat'],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const emptyState = {
      jobId: 'job-empty',
      caption: '',
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const goodResult = await qualityCheckNode(goodState);
    const emptyResult = await qualityCheckNode(emptyState);

    const goodScores = goodResult.qualityScores as Record<string, number>;
    const emptyScores = emptyResult.qualityScores as Record<string, number>;
    const goodAvg = goodScores.average ?? 0;
    const emptyAvg = emptyScores.average ?? 0;

    expect(goodAvg).toBeGreaterThan(emptyAvg);
  });

  it('images present increases visual_quality score', async () => {
    const withImages = {
      jobId: 'job-img',
      caption: 'Un rituel simple.',
      script: null,
      hashtags: [],
      images: [{ provider: 'openai', url: 'https://example.com/1.png' }],
      videos: [],
      format: 'post',
      retries: {},
    };

    const withoutImages = {
      jobId: 'job-noimg',
      caption: 'Un rituel simple.',
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const withResult = await qualityCheckNode(withImages);
    const withoutResult = await qualityCheckNode(withoutImages);

    const withScores = withResult.qualityScores as Record<string, number>;
    const withoutScores = withoutResult.qualityScores as Record<string, number>;
    const withVisual = withScores.visual_quality ?? 0;
    const withoutVisual = withoutScores.visual_quality ?? 0;

    expect(withVisual).toBeGreaterThan(withoutVisual);
  });

  it('sets currentStep to quality_check', async () => {
    const state = {
      jobId: 'job-step',
      caption: 'Test caption.',
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const result = await qualityCheckNode(state);
    expect(result.currentStep).toBe('quality_check');
  });

  it('increments retry counter for qualityCheck', async () => {
    const state = {
      jobId: 'job-retry',
      caption: 'Test caption.',
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: { qualityCheck: 1 },
    };

    const result = await qualityCheckNode(state);
    const retries = result.retries as Record<string, number>;

    expect(retries.qualityCheck).toBe(2);
  });

  it('starts retry counter at 1 if no previous retries', async () => {
    const state = {
      jobId: 'job-first-retry',
      caption: 'Test.',
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const result = await qualityCheckNode(state);
    const retries = result.retries as Record<string, number>;

    expect(retries.qualityCheck).toBe(1);
  });
});
