import { describe, expect, it, vi, beforeEach } from 'vitest';

const defaultConfig = {
  enabled: true,
  defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  budget: { dailyCents: 1000, maxPerJobCents: 100 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  providers: {
    text: { default: 'openai', model: 'gpt-4o-mini' },
    image: { default: 'mock', model: 'mock' },
    video: { default: 'mock' },
    tts: { default: 'mock' },
  },
  apiKeys: { openai: undefined, anthropic: undefined, google: undefined, elevenlabs: undefined },
};

let configOverride: Record<string, unknown> | null = null;

vi.mock('../config', () => ({
  getEngineConfig: () => configOverride ?? defaultConfig,
}));

vi.mock('@langchain/langgraph', () => ({
  interrupt: () => ({ decision: 'approved', feedback: 'looks good' }),
}));

import { humanReviewNode } from './human-review';

describe('humanReviewNode', () => {
  beforeEach(() => {
    configOverride = null;
  });

  const baseState = {
    jobId: 'job-hr-1',
    script: { hook: 'A hook.' },
    caption: 'A caption.',
    hashtags: ['femiglow'],
    images: [],
    videos: [],
    qualityScores: { average: 0.85 },
    moderationResult: { safe: true },
    humanReview: null,
  };

  it('auto-approves when humanReviewRequired=false', async () => {
    const result = await humanReviewNode(baseState);
    const review = result.humanReview as Record<string, unknown>;
    expect(review).toBeDefined();
    expect(review.decision).toBe('approved');
  });

  it('returns decision "approved" when auto-approved', async () => {
    const result = await humanReviewNode(baseState);
    const review = result.humanReview as Record<string, unknown>;
    expect(review.decision).toBe('approved');
  });

  it('sets currentStep to human_review', async () => {
    const result = await humanReviewNode(baseState);
    expect(result.currentStep).toBe('human_review');
  });

  it('passes through existing humanReview decision', async () => {
    const state = {
      ...baseState,
      humanReview: { decision: 'rejected', feedback: 'Not good enough.' },
    };
    const result = await humanReviewNode(state);
    // When existing decision is present, node returns currentStep only
    expect(result.currentStep).toBe('human_review');
    // The existing humanReview stays in state (not overwritten)
    expect(result.humanReview).toBeUndefined();
  });

  it('decision field is one of the valid values', async () => {
    const result = await humanReviewNode(baseState);
    const review = result.humanReview as Record<string, unknown>;
    if (review) {
      const validDecisions = ['approved', 'approved_direct', 'rejected', 'edit_requested'];
      expect(validDecisions).toContain(review.decision);
    }
  });

  it('works with minimal state', async () => {
    const state = {
      jobId: 'job-hr-minimal',
      humanReview: null,
    };
    const result = await humanReviewNode(state);
    expect(result.currentStep).toBe('human_review');
  });

  it('returns reviewPayload when HITL required via interrupt', async () => {
    // Override config to require human review
    configOverride = {
      ...defaultConfig,
      quality: { ...defaultConfig.quality, humanReviewRequired: true },
    };

    const result = await humanReviewNode(baseState);
    // interrupt() is called and returns the mocked decision
    const review = result.humanReview as Record<string, unknown>;
    expect(review).toBeDefined();
    expect(review.decision).toBe('approved');
  });

  it('sets correct status with auto-approve', async () => {
    const result = await humanReviewNode(baseState);
    expect(result.currentStep).toBe('human_review');
    const review = result.humanReview as Record<string, unknown>;
    expect(review.decision).toBe('approved');
  });
});
