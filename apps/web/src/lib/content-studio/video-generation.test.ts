import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// We test through dynamic imports so per-test env overrides take effect on
// the freshly resolved module (env.ts reads process.env at module load).

const ORIGINAL_ENV = { ...process.env };

describe('content-studio/video-generation', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.CONTENT_STUDIO_VIDEO_PROVIDER = 'mock';
    process.env.CONTENT_STUDIO_VIDEO_MODEL = 'mock-video-1.0';
    process.env.CONTENT_STUDIO_V2_MOCK_MODE = 'false';
    vi.resetModules();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns the reel mock asset for format=reel', async () => {
    const { generateStudioVideo } = await import('./video-generation');
    const out = await generateStudioVideo({ format: 'reel', prompt: 'soin rituel' });
    expect(out.publicUrl).toBe('/_media/content-studio/mock/reel-9x16.mp4');
    expect(out.width).toBe(1080);
    expect(out.height).toBe(1920);
    expect(out.durationMs).toBe(5000);
    expect(out.provider).toBe('mock');
    expect(out.estimatedCostCents).toBe(0);
    expect(out.mime).toBe('video/mp4');
  });

  it('returns the story mock asset for format=story', async () => {
    const { generateStudioVideo } = await import('./video-generation');
    const out = await generateStudioVideo({ format: 'story', prompt: 'matinée slow' });
    expect(out.publicUrl).toBe('/_media/content-studio/mock/story-9x16.mp4');
    expect(out.durationMs).toBe(3000);
  });

  it('throws for format=post (no video mock)', async () => {
    const { generateStudioVideo } = await import('./video-generation');
    await expect(
      generateStudioVideo({ format: 'post', prompt: 'flat-lay' }),
    ).rejects.toThrow(/Aucun mock vidéo/);
  });

  it('throws for format=carousel (no video mock)', async () => {
    const { generateStudioVideo } = await import('./video-generation');
    await expect(
      generateStudioVideo({ format: 'carousel', prompt: 'séries 3 images' }),
    ).rejects.toThrow(/Aucun mock vidéo/);
  });

  it('uses CONTENT_STUDIO_VIDEO_MODEL env value when no model passed', async () => {
    process.env.CONTENT_STUDIO_VIDEO_MODEL = 'mock-video-2.0';
    const { generateStudioVideo } = await import('./video-generation');
    const out = await generateStudioVideo({ format: 'reel', prompt: '...' });
    expect(out.model).toBe('mock-video-2.0');
  });

  it('uses the explicit model parameter when provided', async () => {
    const { generateStudioVideo } = await import('./video-generation');
    const out = await generateStudioVideo({ format: 'reel', prompt: '...', model: 'custom-v1' });
    expect(out.model).toBe('custom-v1');
  });

  it('throws when provider != mock and global mock-mode is off', async () => {
    process.env.CONTENT_STUDIO_VIDEO_PROVIDER = 'veo';
    process.env.CONTENT_STUDIO_V2_MOCK_MODE = 'false';
    const { generateStudioVideo } = await import('./video-generation');
    await expect(
      generateStudioVideo({ format: 'reel', prompt: 'x' }),
    ).rejects.toThrow(/n'est pas encore implémenté/);
  });

  it('falls back to mock when CONTENT_STUDIO_V2_MOCK_MODE=true even if provider != mock', async () => {
    process.env.CONTENT_STUDIO_VIDEO_PROVIDER = 'veo';
    process.env.CONTENT_STUDIO_V2_MOCK_MODE = 'true';
    const { generateStudioVideo } = await import('./video-generation');
    const out = await generateStudioVideo({ format: 'reel', prompt: 'x' });
    expect(out.provider).toBe('mock');
  });

  describe('isFormatVideoCapable', () => {
    it('returns true for reel and story', async () => {
      const { isFormatVideoCapable } = await import('./video-generation');
      expect(isFormatVideoCapable('reel')).toBe(true);
      expect(isFormatVideoCapable('story')).toBe(true);
    });

    it('returns false for post and carousel', async () => {
      const { isFormatVideoCapable } = await import('./video-generation');
      expect(isFormatVideoCapable('post')).toBe(false);
      expect(isFormatVideoCapable('carousel')).toBe(false);
    });
  });

  describe('Higgsfield routing (live mode)', () => {
    it('mode=mock forces mock regardless of model', async () => {
      process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf_test:secret_test';
      const { generateStudioVideo } = await import('./video-generation');
      const out = await generateStudioVideo({
        format: 'reel',
        prompt: 'p',
        model: 'hf-video-standard',
        mode: 'mock',
      });
      expect(out.provider).toBe('mock');
    });

    it('mode=live + hf-* model sans API key → erreur', async () => {
      process.env.AI_ENGINE_HIGGSFIELD_API_KEY = '';
      const { generateStudioVideo } = await import('./video-generation');
      await expect(
        generateStudioVideo({
          format: 'reel',
          prompt: 'p',
          model: 'hf-video-lite',
          mode: 'live',
        }),
      ).rejects.toThrow(/credential Higgsfield incomplet/);
    });

    it('mode=live + hf-video-mini → POST /videos/generate + polling jusque completed', async () => {
      process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf_test:secret_test';
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (url) => {
          const u = String(url);
          if (u.endsWith('/videos/generate')) {
            return new Response(JSON.stringify({ job_id: 'job_abc' }), {
              status: 200,
            });
          }
          if (u.includes('/videos/status/')) {
            return new Response(
              JSON.stringify({ status: 'completed', video_url: 'https://hf/result.mp4' }),
              { status: 200 },
            );
          }
          throw new Error(`unexpected fetch ${u}`);
        });
      // accélère le polling — pas d'attente réelle
      vi.useFakeTimers();
      const { generateStudioVideo } = await import('./video-generation');
      const promise = generateStudioVideo({
        format: 'reel',
        prompt: 'p',
        model: 'hf-video-mini',
        mode: 'live',
      });
      // avance le premier poll
      await vi.advanceTimersByTimeAsync(6_000);
      const out = await promise;
      vi.useRealTimers();
      expect(out.provider).toBe('higgsfield');
      expect(out.publicUrl).toBe('https://hf/result.mp4');
      expect(out.estimatedCostCents).toBe(400);
      expect(out.model).toBe('hf-video-mini');
      fetchSpy.mockRestore();
    });

    it('hf-video-turbo → durée 10s + coût 6500', async () => {
      process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf_test:secret_test';
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (url, init) => {
          const u = String(url);
          if (u.endsWith('/videos/generate')) {
            const body = JSON.parse((init?.body ?? '{}') as string);
            expect(body.model).toBe('turbo');
            expect(body.duration_seconds).toBe(10);
            return new Response(JSON.stringify({ job_id: 'job_xyz' }), {
              status: 200,
            });
          }
          return new Response(
            JSON.stringify({ status: 'completed', video_url: 'https://hf/r.mp4' }),
            { status: 200 },
          );
        });
      vi.useFakeTimers();
      const { generateStudioVideo } = await import('./video-generation');
      const promise = generateStudioVideo({
        format: 'reel',
        prompt: 'p',
        model: 'hf-video-turbo',
        mode: 'live',
      });
      await vi.advanceTimersByTimeAsync(6_000);
      const out = await promise;
      vi.useRealTimers();
      expect(out.durationMs).toBe(10_000);
      expect(out.estimatedCostCents).toBe(6500);
      fetchSpy.mockRestore();
    });

    it('polling status=failed → throw avec message d\'erreur', async () => {
      process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf_test:secret_test';
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (url) => {
          if (String(url).endsWith('/videos/generate')) {
            return new Response(JSON.stringify({ job_id: 'job_fail' }), { status: 200 });
          }
          return new Response(
            JSON.stringify({ status: 'failed', error: 'content policy violation' }),
            { status: 200 },
          );
        });
      vi.useFakeTimers();
      const { generateStudioVideo } = await import('./video-generation');
      const promise = generateStudioVideo({
        format: 'reel',
        prompt: 'p',
        model: 'hf-video-lite',
        mode: 'live',
      });
      // Attache le handler de rejet AVANT d'avancer les timers : sinon la
      // rejection émise pendant advanceTimersByTimeAsync n'a pas encore de
      // catch attaché, devient transitoirement « unhandled » et fait sortir
      // le process en EXIT 1 (BUG-010 / ACT-BE-001).
      const rejection = expect(promise).rejects.toThrow(/content policy violation/);
      await vi.advanceTimersByTimeAsync(6_000);
      await rejection;
      vi.useRealTimers();
      fetchSpy.mockRestore();
    });
  });
});
