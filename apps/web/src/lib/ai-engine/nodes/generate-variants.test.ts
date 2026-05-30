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

import { generateVariantsNode } from './generate-variants';

describe('generateVariantsNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState = {
    jobId: 'job-var-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover FemiGlow.',
      tone: 'professional',
      productFocus: 'Serum Eclat',
    },
    platform: 'instagram',
    format: 'post',
    script: {
      hook: 'Un geste lent, une main qui retrouve sa lumiere.',
      scenes: [],
      cta: 'En savoir plus',
    },
    caption: 'Un geste lent, une main qui retrouve sa lumiere.\n\nChez FemiGlow, le soin est un geste precis.',
    hashtags: ['femiglow', 'jbeauty', 'rituelbeaute'],
    qualityScores: { average: 0.85 },
  };

  it('returns fallback variants when no API key', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    expect(variants).toBeDefined();
    expect(Array.isArray(variants)).toBe(true);
    expect(variants.length).toBeGreaterThan(0);
  });

  it('fallback generates 3 variants', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    expect(variants.length).toBe(3);
  });

  it('each variant has different label', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    const labels = variants.map((v) => v.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(variants.length);
  });

  it('variants have caption and hashtags', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    for (const variant of variants) {
      expect(typeof variant.caption).toBe('string');
      expect(Array.isArray(variant.hashtags)).toBe(true);
    }
  });

  it('sets currentStep to generate_variants', async () => {
    const result = await generateVariantsNode(baseState);
    expect(result.currentStep).toBe('generate_variants');
  });

  it('selectedVariant is 0', async () => {
    const result = await generateVariantsNode(baseState);
    expect(result.selectedVariant).toBe(0);
  });

  it('variants array is non-empty', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    expect(variants.length).toBeGreaterThan(0);
  });

  it('each variant has modified hook', async () => {
    const result = await generateVariantsNode(baseState);
    const variants = result.variants as Array<Record<string, unknown>>;
    const originalHook = 'Un geste lent, une main qui retrouve sa lumiere.';
    // Each variant should have a different hook from the original or at least have one
    for (const variant of variants) {
      const variantScript = variant.script as Record<string, unknown> | null;
      if (variantScript) {
        expect(typeof variantScript.hook).toBe('string');
        expect((variantScript.hook as string).length).toBeGreaterThan(0);
        // At least one variant should differ from original
      }
    }
    // Verify at least one hook is different from original
    const hooks = variants
      .map((v) => (v.script as Record<string, unknown> | null)?.hook as string)
      .filter(Boolean);
    const hasDifferentHook = hooks.some((h) => h !== originalHook);
    expect(hasDifferentHook).toBe(true);
  });
});
