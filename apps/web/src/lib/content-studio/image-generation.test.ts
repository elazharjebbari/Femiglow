import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('content studio image generation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
    vi.stubEnv('CONTENT_STUDIO_IMAGE_MODEL', 'gpt-image-1-mini');
  });

  it('génère une image mock sans coût OpenAI', async () => {
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'Visuel test FemiGlow sans texte lisible',
      size: '1024x1024',
      quality: 'low',
    });

    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock-low-cost-image');
    expect(result.estimatedCostCents).toBe(0);
    expect(result.mime).toBe('image/png');
    expect(result.buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
