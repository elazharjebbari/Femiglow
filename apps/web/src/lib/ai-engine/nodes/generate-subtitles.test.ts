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
    stat: vi.fn().mockResolvedValue({ size: 512 }),
  };
});

import { generateSubtitlesNode } from './generate-subtitles';

describe('generateSubtitlesNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseState = {
    jobId: 'job-sub-1',
    script: {
      hook: 'Decouvrez le secret des ongles parfaits.',
      scenes: [
        {
          sceneNumber: 1,
          description: 'Opening scene',
          narration: 'Un geste lent, une main qui retrouve sa lumiere.',
          durationSeconds: 5,
        },
        {
          sceneNumber: 2,
          description: 'Product scene',
          narration: 'Le camellia nourrit en profondeur.',
          durationSeconds: 4,
        },
        {
          sceneNumber: 3,
          description: 'Closing scene',
          narration: 'FemiGlow, le rituel commence ici.',
          durationSeconds: 3,
        },
      ],
    },
  };

  it('returns SRT formatted subtitles', async () => {
    const result = await generateSubtitlesNode(baseState);
    const subtitles = result.subtitles as string;
    expect(subtitles).toBeDefined();
    expect(typeof subtitles).toBe('string');
    // SRT format: number, timestamp --> timestamp, text, blank line
    expect(subtitles).toContain('-->');
  });

  it('each scene gets a subtitle entry', async () => {
    const result = await generateSubtitlesNode(baseState);
    const subtitles = result.subtitles as string;
    // Hook + 3 scenes = 4 entries
    const entries = subtitles.split('\n\n').filter(Boolean);
    expect(entries.length).toBe(4);
  });

  it('timing is cumulative', async () => {
    const result = await generateSubtitlesNode(baseState);
    const subtitles = result.subtitles as string;
    const lines = subtitles.split('\n');
    // Find all timestamp lines
    const timestamps = lines.filter((l) => l.includes('-->'));
    expect(timestamps.length).toBe(4);

    // Second entry should start after the hook duration (3s, since Math.min(3, first scene duration))
    // Check that later entries have later start times
    const getStartSeconds = (ts: string) => {
      const parts = ts.split(' --> ')[0]!.trim().split(':');
      const h = parseInt(parts[0]!, 10);
      const m = parseInt(parts[1]!, 10);
      const sAndMs = parts[2]!.split(',');
      const s = parseInt(sAndMs[0]!, 10);
      return h * 3600 + m * 60 + s;
    };

    for (let i = 1; i < timestamps.length; i++) {
      expect(getStartSeconds(timestamps[i]!)).toBeGreaterThan(getStartSeconds(timestamps[i - 1]!));
    }
  });

  it('hook gets first entry', async () => {
    const result = await generateSubtitlesNode(baseState);
    const subtitles = result.subtitles as string;
    const firstEntry = subtitles.split('\n\n')[0]!;
    expect(firstEntry).toContain('Decouvrez le secret des ongles parfaits.');
  });

  it('empty scenes returns empty subtitles', async () => {
    const emptyState = {
      jobId: 'job-sub-2',
      script: {
        hook: '',
        scenes: [],
      },
    };

    const result = await generateSubtitlesNode(emptyState);
    const subtitles = result.subtitles as string;
    expect(subtitles).toBe('');
  });

  it('sets currentStep', async () => {
    const result = await generateSubtitlesNode(baseState);
    expect(result.currentStep).toBe('generate_subtitles');
  });
});
