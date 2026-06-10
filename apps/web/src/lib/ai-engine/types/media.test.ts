import { describe, expect, it } from 'vitest';
import type { MediaAsset, StepError, CostTracking } from './media';

describe('MediaAsset interface', () => {
  it('accepts valid object', () => {
    const asset: MediaAsset = {
      assetId: 'asset-001',
      url: 'https://cdn.example.com/image.jpg',
      mimeType: 'image/jpeg',
      width: 1080,
      height: 1080,
      fileSizeBytes: 204800,
      provider: 'openai',
      generationParams: { model: 'dall-e-3', prompt: 'test' },
      costCents: 4,
    };

    expect(asset.assetId).toBe('asset-001');
    expect(asset.mimeType).toBe('image/jpeg');
    expect(asset.width).toBe(1080);
    expect(asset.costCents).toBe(4);
  });
});

describe('StepError interface', () => {
  it('accepts valid object', () => {
    const error: StepError = {
      node: 'generate-script',
      errorType: 'ProviderError',
      message: 'API rate limit exceeded',
      timestamp: '2026-05-25T10:00:00.000Z',
      provider: 'anthropic',
      retryable: true,
    };

    expect(error.node).toBe('generate-script');
    expect(error.retryable).toBe(true);
    expect(error.provider).toBe('anthropic');
  });
});

describe('CostTracking interface', () => {
  it('accepts valid object', () => {
    const tracking: CostTracking = {
      totalCents: 15,
      breakdown: { 'generate-script': 8, 'generate-caption': 3, 'generate-images': 4 },
      tokensUsed: { input: 5000, output: 2000 },
      budgetRemainingCents: 485,
    };

    expect(tracking.totalCents).toBe(15);
    expect(tracking.breakdown['generate-script']).toBe(8);
    expect(tracking.budgetRemainingCents).toBe(485);
  });
});

describe('structural typing (extra fields)', () => {
  it('objects with extra fields are still valid', () => {
    const asset: MediaAsset = {
      assetId: 'asset-002',
      url: 'https://cdn.example.com/video.mp4',
      mimeType: 'video/mp4',
      durationMs: 30000,
      fileSizeBytes: 10485760,
      provider: 'runway',
      generationParams: { model: 'gen-3', style: 'cinematic' },
      costCents: 25,
    };

    // TypeScript structural typing allows extra fields at the value level.
    // Casting through unknown simulates receiving data with extra fields.
    const extended = { ...asset, customField: 'extra', priority: 1 } as unknown as MediaAsset;
    expect(extended.assetId).toBe('asset-002');
    expect((extended as unknown as Record<string, unknown>)['customField']).toBe('extra');
  });
});
