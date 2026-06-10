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
    stat: vi.fn().mockResolvedValue({ size: 4096 }),
  };
});

vi.mock('fluent-ffmpeg', () => {
  const cmd = {
    input: vi.fn().mockReturnThis(),
    inputFormat: vi.fn().mockReturnThis(),
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

import { generateMusicNode } from './generate-music';

describe('generateMusicNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseState = {
    jobId: 'job-music-1',
    script: {
      hook: 'Test hook',
      scenes: [
        { sceneNumber: 1, description: 'Scene 1', durationSeconds: 5 },
        { sceneNumber: 2, description: 'Scene 2', durationSeconds: 5 },
      ],
      musicMood: 'calm',
      estimatedDurationSeconds: 20,
    },
  };

  it('returns mock music asset', async () => {
    const result = await generateMusicNode(baseState);
    expect(result.music).toBeDefined();
    const music = result.music as Record<string, unknown>;
    expect(music.mimeType).toBe('audio/wav');
    expect(music.assetId).toBeDefined();
    expect(typeof music.url).toBe('string');
  });

  it('music duration matches script estimated duration', async () => {
    const result = await generateMusicNode(baseState);
    const music = result.music as Record<string, unknown>;
    // The estimatedDurationSeconds from script is 20, so durationMs should be 20000
    expect(music.durationMs).toBe(20000);
  });

  it('provider is mock/fallback', async () => {
    const result = await generateMusicNode(baseState);
    const music = result.music as Record<string, unknown>;
    expect(['mock', 'fallback']).toContain(music.provider);
  });

  it('cost is 0', async () => {
    const result = await generateMusicNode(baseState);
    const music = result.music as Record<string, unknown>;
    expect(music.costCents).toBe(0);

    const costTracking = result.costTracking as Record<string, unknown>;
    const breakdown = costTracking.breakdown as Record<string, number>;
    expect(breakdown.generate_music).toBe(0);
  });

  it('sets currentStep', async () => {
    const result = await generateMusicNode(baseState);
    expect(result.currentStep).toBe('generate_music');
  });

  it('works with no musicMood', async () => {
    const noMoodState = {
      jobId: 'job-music-2',
      script: {
        hook: 'Test',
        scenes: [],
        estimatedDurationSeconds: 15,
      },
    };

    const result = await generateMusicNode(noMoodState);
    expect(result.music).toBeDefined();
    const music = result.music as Record<string, unknown>;
    const params = music.generationParams as Record<string, unknown>;
    // Falls back to 'calm'
    expect(params.mood).toBe('calm');
  });
});
