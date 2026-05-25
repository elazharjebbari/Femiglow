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

// Use plain functions so vi.restoreAllMocks does not strip implementations.
vi.mock('fluent-ffmpeg', () => {
  function createMockCmd() {
    const callbacks: Record<string, (...a: unknown[]) => void> = {};
    const cmd: Record<string, unknown> = {};
    cmd.input = () => cmd;
    cmd.inputFormat = () => cmd;
    cmd.outputOptions = () => cmd;
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

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: async () => undefined,
    stat: async () => ({ size: 5000 }),
    writeFile: async () => undefined,
  };
});

import { generateVoiceoverNode } from './generate-voiceover';

describe('generateVoiceoverNode', () => {
  const baseState = {
    jobId: 'job-vo-1',
    script: {
      hook: 'Un geste lent, une main qui retrouve sa lumiere.',
      scenes: [
        { sceneNumber: 1, description: 'Scene one description here', durationSeconds: 4 },
        { sceneNumber: 2, description: 'Scene two description here', durationSeconds: 5 },
      ],
      estimatedDurationSeconds: 15,
    },
  };

  it('returns mock silent audio', async () => {
    const result = await generateVoiceoverNode(baseState);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(voiceover).toBeDefined();
    expect(voiceover.provider).toBe('mock');
  });

  it('sets currentStep to generate_voiceover', async () => {
    const result = await generateVoiceoverNode(baseState);
    expect(result.currentStep).toBe('generate_voiceover');
  });

  it('works with no script', async () => {
    const state = { jobId: 'job-vo-noscript', script: null };
    const result = await generateVoiceoverNode(state);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(voiceover).toBeDefined();
    // With null script, buildVoiceoverText returns 'Le rituel FemiGlow.'
    expect(result.voiceoverScript).toBe('Le rituel FemiGlow.');
  });

  it('voiceover duration is set', async () => {
    const result = await generateVoiceoverNode(baseState);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(typeof voiceover.durationMs).toBe('number');
    expect(voiceover.durationMs as number).toBeGreaterThanOrEqual(0);
  });

  it('cost is 0 for mock', async () => {
    const result = await generateVoiceoverNode(baseState);
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost.totalCents).toBe(0);
    expect((cost.breakdown as Record<string, number>).generate_voiceover).toBe(0);
  });

  it('mimeType is audio/wav for mock', async () => {
    const result = await generateVoiceoverNode(baseState);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(voiceover.mimeType).toBe('audio/wav');
  });

  it('provider is mock', async () => {
    const result = await generateVoiceoverNode(baseState);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(voiceover.provider).toBe('mock');
  });

  it('works with empty hook', async () => {
    const state = {
      jobId: 'job-vo-emptyhook',
      script: {
        hook: '',
        scenes: [{ sceneNumber: 1, description: 'A single scene', durationSeconds: 3 }],
      },
    };
    const result = await generateVoiceoverNode(state);
    const voiceover = result.voiceover as Record<string, unknown>;
    expect(voiceover).toBeDefined();
    expect(typeof result.voiceoverScript).toBe('string');
  });
});
