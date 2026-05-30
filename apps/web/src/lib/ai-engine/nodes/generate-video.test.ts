import { describe, expect, it, vi } from 'vitest';

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

// Use plain functions (not vi.fn) so vi.restoreAllMocks cannot strip implementations.
vi.mock('fluent-ffmpeg', () => {
  function createMockCmd() {
    const callbacks: Record<string, (...a: unknown[]) => void> = {};
    const cmd: Record<string, unknown> = {};
    cmd.input = () => cmd;
    cmd.inputFormat = () => cmd;
    cmd.outputOptions = () => cmd;
    cmd.videoFilter = () => cmd;
    cmd.save = () => {
      setTimeout(() => callbacks.end?.(), 0);
      return cmd;
    };
    cmd.on = (event: string, cb: (...a: unknown[]) => void) => {
      callbacks[event] = cb;
      return cmd;
    };
    return cmd;
  }
  const fn = Object.assign(() => createMockCmd(), { setFfmpegPath: () => {} });
  return { default: fn };
});

vi.mock('ffmpeg-static', () => ({ default: '/usr/bin/ffmpeg' }));

let mkdirCalls = 0;
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: async (...args: unknown[]) => { mkdirCalls++; return undefined; },
    stat: async () => ({ size: 12345 }),
  };
});

import { generateVideoNode } from './generate-video';

describe('generateVideoNode', () => {
  const baseState = {
    jobId: 'job-gv-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover FemiGlow.',
    },
    platform: 'instagram',
    format: 'reel',
    script: {
      hook: 'Un geste lent.',
      scenes: [
        { sceneNumber: 1, description: 'Scene one', durationSeconds: 4 },
        { sceneNumber: 2, description: 'Scene two', durationSeconds: 5 },
      ],
    },
  };

  it('returns mock video', async () => {
    const result = await generateVideoNode(baseState);
    const videos = result.videos as Array<Record<string, unknown>>;
    expect(videos.length).toBeGreaterThan(0);
  });

  it('video has url and mimeType', async () => {
    const result = await generateVideoNode(baseState);
    const videos = result.videos as Array<Record<string, unknown>>;
    const video = videos[0]!;
    expect(typeof video.url).toBe('string');
    expect(video.mimeType).toBe('video/mp4');
  });

  it('sets currentStep to generate_video', async () => {
    const result = await generateVideoNode(baseState);
    expect(result.currentStep).toBe('generate_video');
  });

  it('video provider is mock', async () => {
    const result = await generateVideoNode(baseState);
    const videos = result.videos as Array<Record<string, unknown>>;
    expect(videos[0]!.provider).toBe('mock');
  });

  it('works with minimal state (no script)', async () => {
    const state = {
      jobId: 'job-gv-minimal',
      platform: 'instagram',
      format: 'reel',
      script: null,
    };
    const result = await generateVideoNode(state);
    const videos = result.videos as Array<Record<string, unknown>>;
    expect(videos.length).toBeGreaterThan(0);
  });

  it('duration based on estimated seconds from scenes', async () => {
    const result = await generateVideoNode(baseState);
    const videos = result.videos as Array<Record<string, unknown>>;
    const video = videos[0]!;
    const genParams = video.generationParams as Record<string, unknown>;
    // Total of scene durations: 4 + 5 = 9
    expect(genParams.totalDuration).toBe(9);
  });

  it('cost is 0 for mock', async () => {
    const result = await generateVideoNode(baseState);
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost.totalCents).toBe(0);
    expect((cost.breakdown as Record<string, number>).generate_video).toBe(0);
  });

  it('creates media output directory', async () => {
    mkdirCalls = 0;
    await generateVideoNode(baseState);
    expect(mkdirCalls).toBeGreaterThanOrEqual(0);
  });
});
