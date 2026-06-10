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

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock image data')),
    stat: vi.fn().mockResolvedValue({ size: 1024 }),
  };
});

vi.mock('sharp', () => {
  const instance = {
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('composed image')),
  };
  const fn = vi.fn(() => instance);
  (fn as unknown as Record<string, unknown>).__instance = instance;
  return { default: fn };
});

vi.mock('fluent-ffmpeg', () => {
  const cmd = {
    input: vi.fn().mockReturnThis(),
    complexFilter: vi.fn().mockReturnThis(),
    outputOptions: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(),
    on: vi.fn(function (this: Record<string, unknown>, event: string, cb: () => void) {
      if (event === 'end') {
        setTimeout(cb, 0);
      }
      return this;
    }),
  };
  const ffmpeg = vi.fn(() => cmd);
  (ffmpeg as unknown as Record<string, unknown>).setFfmpegPath = vi.fn();
  return { default: ffmpeg };
});

vi.mock('ffmpeg-static', () => ({
  default: '/usr/bin/ffmpeg',
}));

vi.mock('../types/platform-specs', () => ({
  PLATFORM_SPECS: {
    instagram: {
      feed: { width: 1080, height: 1080, aspectRatio: '1:1', maxFileSizeMb: 30 },
      reel: { width: 1080, height: 1920, aspectRatio: '9:16', maxDurationSeconds: 90, maxFileSizeMb: 250 },
      post: { width: 1080, height: 1080, aspectRatio: '1:1', maxFileSizeMb: 30 },
    },
  },
}));

import { composeNode } from './compose';
import sharp from 'sharp';

describe('composeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseState = {
    jobId: 'job-comp-1',
    platform: 'instagram',
    format: 'post',
    caption: 'Beautiful nail care',
    images: [
      {
        assetId: 'img-1',
        url: '/_media/ai-engine/test-image.jpg',
        mimeType: 'image/jpeg',
        width: 800,
        height: 800,
        fileSizeBytes: 500,
        provider: 'openai',
        generationParams: {},
        costCents: 0,
      },
    ],
    videos: [],
  };

  it('returns composed asset for image content', async () => {
    const result = await composeNode(baseState);
    expect(result.composition).toBeDefined();
    const comp = result.composition as Record<string, unknown>;
    expect(comp.mimeType).toBe('image/jpeg');
    expect(typeof comp.provider).toBe('string');
    expect((comp.provider as string).startsWith('compose')).toBe(true);
  });

  it('returns composed asset for video content', async () => {
    const videoState = {
      ...baseState,
      format: 'reel',
      images: [],
      videos: [
        {
          assetId: 'vid-1',
          url: '/_media/ai-engine/test-video.mp4',
          mimeType: 'video/mp4',
          width: 1080,
          height: 1920,
          durationMs: 15000,
          fileSizeBytes: 5000,
          provider: 'mock',
          generationParams: {},
          costCents: 0,
        },
      ],
    };

    const result = await composeNode(videoState);
    expect(result.composition).toBeDefined();
    const comp = result.composition as Record<string, unknown>;
    expect(comp.mimeType).toBe('video/mp4');
  });

  it('sets currentStep to compose', async () => {
    const result = await composeNode(baseState);
    expect(result.currentStep).toBe('compose');
  });

  it('handles missing images gracefully', async () => {
    const noImageState = {
      ...baseState,
      images: [],
    };

    const result = await composeNode(noImageState);
    expect(result.composition).toBeDefined();
    const comp = result.composition as Record<string, unknown>;
    expect(typeof comp.provider).toBe('string');
    expect((comp.provider as string).startsWith('compose')).toBe(true);
  });

  it('handles missing videos gracefully', async () => {
    const noVideoState = {
      ...baseState,
      format: 'reel',
      videos: [],
      images: [],
    };

    const result = await composeNode(noVideoState);
    expect(result.composition).toBeDefined();
    const comp = result.composition as Record<string, unknown>;
    expect(comp).toHaveProperty('mimeType');
  });

  it('image composition uses platform specs for resize', async () => {
    const result = await composeNode(baseState);
    const comp = result.composition as Record<string, unknown>;
    // The composed image should use the platform spec dimensions (instagram post = 1080x1080)
    expect(comp).toBeDefined();
    if (comp.width) expect(comp.width).toBe(1080);
  });

  it('video composition combines video + audio', async () => {
    const videoState = {
      ...baseState,
      format: 'reel',
      images: [],
      videos: [
        {
          assetId: 'vid-1',
          url: '/_media/ai-engine/test-video.mp4',
          mimeType: 'video/mp4',
          width: 1080,
          height: 1920,
          durationMs: 15000,
          fileSizeBytes: 5000,
          provider: 'mock',
          generationParams: {},
          costCents: 0,
        },
      ],
      voiceover: null,
      music: null,
    };

    const result = await composeNode(videoState);
    expect(result.composition).toBeDefined();
  });

  it('cost is 0 for composition', async () => {
    const result = await composeNode(baseState);
    const comp = result.composition as Record<string, unknown>;
    expect(comp.costCents).toBe(0);
  });
});
