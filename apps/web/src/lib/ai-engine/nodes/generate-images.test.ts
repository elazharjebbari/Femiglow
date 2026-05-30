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

import { generateImagesNode } from './generate-images';

describe('generateImagesNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState = {
    jobId: 'job-gi-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover FemiGlow.',
    },
    platform: 'instagram',
    format: 'post',
    script: {
      hook: 'A gentle ritual.',
      scenes: [],
      visualDirection: [
        {
          element: 'product_hero',
          style: 'minimal_japanese',
          colors: ['cream', 'sage'],
          composition: 'centered',
        },
        {
          element: 'hands',
          style: 'bright_natural',
          colors: ['skin_tone', 'cream'],
          composition: 'closeup',
        },
      ],
    },
    brandGuidelines: 'FemiGlow brand guidelines.',
  };

  it('returns mock images when provider is mock', async () => {
    const result = await generateImagesNode(baseState);
    const images = result.images as Array<Record<string, unknown>>;
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]!.provider).toBe('mock');
  });

  it('mock image has assetId, url, mimeType, width, height, provider', async () => {
    const result = await generateImagesNode(baseState);
    const images = result.images as Array<Record<string, unknown>>;
    const img = images[0]!;
    expect(img.assetId).toBeDefined();
    expect(typeof img.assetId).toBe('string');
    expect(img.url).toBeDefined();
    expect(typeof img.url).toBe('string');
    expect(img.mimeType).toBe('image/png');
    expect(typeof img.width).toBe('number');
    expect(typeof img.height).toBe('number');
    expect(img.provider).toBe('mock');
  });

  it('post format generates 1 image', async () => {
    const result = await generateImagesNode({ ...baseState, format: 'post' });
    const images = result.images as Array<Record<string, unknown>>;
    expect(images.length).toBe(1);
  });

  it('carousel format generates up to 5 images', async () => {
    const manyNotes = Array.from({ length: 8 }, (_, i) => ({
      element: `element_${i}`,
      style: 'minimal_japanese',
      colors: ['cream'],
      composition: 'centered',
    }));
    const state = {
      ...baseState,
      format: 'carousel',
      script: { ...baseState.script, visualDirection: manyNotes },
    };
    const result = await generateImagesNode(state);
    const images = result.images as Array<Record<string, unknown>>;
    expect(images.length).toBeLessThanOrEqual(5);
    expect(images.length).toBeGreaterThan(1);
  });

  it('sets currentStep to generate_images', async () => {
    const result = await generateImagesNode(baseState);
    expect(result.currentStep).toBe('generate_images');
  });

  it('images array is non-empty', async () => {
    const result = await generateImagesNode(baseState);
    const images = result.images as Array<Record<string, unknown>>;
    expect(images.length).toBeGreaterThan(0);
  });

  it('each image has provider=mock when mock', async () => {
    const result = await generateImagesNode(baseState);
    const images = result.images as Array<Record<string, unknown>>;
    for (const img of images) {
      expect(img.provider).toBe('mock');
    }
  });

  it('image dimensions match platform specs', async () => {
    const result = await generateImagesNode({ ...baseState, platform: 'instagram', format: 'post' });
    const images = result.images as Array<Record<string, unknown>>;
    const img = images[0]!;
    // Instagram post = 1080x1080
    expect(img.width).toBe(1080);
    expect(img.height).toBe(1080);
  });

  it('tracks cost (0 for mock)', async () => {
    const result = await generateImagesNode(baseState);
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost).toBeDefined();
    expect(cost.totalCents).toBe(0);
    expect((cost.breakdown as Record<string, number>).generate_images).toBe(0);
  });

  it('works with no visualDirection in script', async () => {
    const state = {
      ...baseState,
      script: { hook: 'Test hook.', scenes: [] },
    };
    const result = await generateImagesNode(state);
    const images = result.images as Array<Record<string, unknown>>;
    expect(images.length).toBeGreaterThan(0);
  });
});
