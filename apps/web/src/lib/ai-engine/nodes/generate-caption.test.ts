import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  getEngineConfig: () => ({
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
  }),
}));

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockRejectedValue(new Error('No API key')),
  })),
}));

import { generateCaptionNode } from './generate-caption';

describe('generateCaptionNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState = {
    jobId: 'job-gc-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover FemiGlow ritual.',
      tone: 'professional',
      productFocus: 'Serum Eclat',
      targetAudience: 'Femmes 25-45 ans',
    },
    platform: 'instagram',
    format: 'post',
    script: {
      hook: 'Un geste lent, une main qui retrouve sa lumiere naturelle.',
      cta: 'En savoir plus',
      scenes: [],
    },
    knowledgeContext: 'Some knowledge context.',
  };

  it('returns fallback caption when no API key', async () => {
    const result = await generateCaptionNode(baseState);
    expect(result.caption).toBeDefined();
    expect(typeof result.caption).toBe('string');
    expect((result.caption as string).length).toBeGreaterThan(0);
  });

  it('fallback caption includes hook from script', async () => {
    const result = await generateCaptionNode(baseState);
    const caption = result.caption as string;
    expect(caption).toContain('Un geste lent, une main qui retrouve sa lumiere naturelle.');
  });

  it('fallback caption includes cta', async () => {
    const result = await generateCaptionNode(baseState);
    const caption = result.caption as string;
    expect(caption).toContain('En savoir plus');
  });

  it('fallback hashtags include "femiglow"', async () => {
    const result = await generateCaptionNode(baseState);
    const hashtags = result.hashtags as string[];
    expect(hashtags).toContain('femiglow');
  });

  it('sets currentStep to generate_caption', async () => {
    const result = await generateCaptionNode(baseState);
    expect(result.currentStep).toBe('generate_caption');
  });

  it('caption is non-empty string', async () => {
    const result = await generateCaptionNode(baseState);
    expect(typeof result.caption).toBe('string');
    expect((result.caption as string).length).toBeGreaterThan(0);
  });

  it('hashtags is non-empty array', async () => {
    const result = await generateCaptionNode(baseState);
    expect(Array.isArray(result.hashtags)).toBe(true);
    expect((result.hashtags as string[]).length).toBeGreaterThan(0);
  });

  it('CTA text is set', async () => {
    const result = await generateCaptionNode(baseState);
    expect(result.ctaText).toBeDefined();
    expect(typeof result.ctaText).toBe('string');
    expect((result.ctaText as string).length).toBeGreaterThan(0);
  });

  it('tracks cost in costTracking', async () => {
    const result = await generateCaptionNode(baseState);
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost).toBeDefined();
    expect(typeof cost.totalCents).toBe('number');
    expect(cost.breakdown).toBeDefined();
    expect((cost.breakdown as Record<string, number>).generate_caption).toBeDefined();
  });

  it('works with null script (uses defaults)', async () => {
    const state = { ...baseState, script: null };
    const result = await generateCaptionNode(state);
    expect(result.caption).toBeDefined();
    const caption = result.caption as string;
    // When script is null, fallback uses default hook
    expect(caption).toContain('Le rituel commence ici.');
  });

  it('caption does not contain emoji', async () => {
    const result = await generateCaptionNode(baseState);
    const caption = result.caption as string;
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiRegex.test(caption)).toBe(false);
  });

  it('caption does not contain exclamation marks', async () => {
    const result = await generateCaptionNode(baseState);
    const caption = result.caption as string;
    expect(caption).not.toContain('!');
  });
});
