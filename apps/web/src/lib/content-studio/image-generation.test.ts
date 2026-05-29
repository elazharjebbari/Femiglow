import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

async function tinyPngBase64(): Promise<string> {
  const buf = await sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  return buf.toString('base64');
}

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

  it('mode=mock force le mock même si CONTENT_STUDIO_IMAGE_PROVIDER=openai', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'openai');
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'mock override test',
      size: '1024x1024',
      quality: 'low',
      mode: 'mock',
    });
    expect(result.provider).toBe('mock');
  });

  it('mode=live + modèle gpt-image-1 + CONTENT_STUDIO_IMAGE_PROVIDER=mock → appelle OpenAI (PAS mock)', async () => {
    // C'est exactement le bug rapporté : env=mock mais user veut un vrai appel.
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk_test_openai');
    const pngB64 = await tinyPngBase64();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      expect(String(url)).toContain('api.openai.com/v1/images/generations');
      const body = JSON.parse(((init as RequestInit | undefined)?.body ?? '{}') as string);
      // Critical: the SELECTED model id is sent, not the env default
      expect(body.model).toBe('gpt-image-1');
      return new Response(
        JSON.stringify({ data: [{ b64_json: pngB64 }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'live openai',
      size: '1024x1024',
      quality: 'high',
      model: 'gpt-image-1',
      mode: 'live',
    });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-image-1');
    fetchSpy.mockRestore();
  });

  it('mode=live + modèle OpenAI sans AUCUNE clé OpenAI résolue → erreur explicite', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
    // ACT-ARC-013/BE-010 : la résolution est désormais unifiée sur toute la
    // chaîne d'env — on neutralise TOUTES les variables pour reproduire le cas
    // « aucune clé » (sinon un OPENAI_API_KEY ambiant débloquerait, à raison).
    vi.stubEnv('AI_ENGINE_OPENAI_API_KEY', '');
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', '');
    vi.stubEnv('CHAT_OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { generateStudioImage } = await import('./image-generation');
    await expect(
      generateStudioImage({
        prompt: 'live no key',
        size: '1024x1024',
        quality: 'low',
        model: 'gpt-image-1-mini',
        mode: 'live',
      }),
    ).rejects.toThrow(/aucune clé OpenAI résolue/);
  });

  it('mode=live + modèle dall-e-3 → appelle OpenAI avec dall-e-3 (pas env default)', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
    vi.stubEnv('CONTENT_STUDIO_IMAGE_MODEL', 'gpt-image-1-mini'); // env default ≠ selected
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk_test');
    const pngB64 = await tinyPngBase64();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(((init as RequestInit | undefined)?.body ?? '{}') as string);
      expect(body.model).toBe('dall-e-3');
      return new Response(
        JSON.stringify({ data: [{ b64_json: pngB64 }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'dall-e',
      size: '1024x1024',
      quality: 'medium',
      model: 'dall-e-3',
      mode: 'live',
    });
    expect(result.model).toBe('dall-e-3');
    fetchSpy.mockRestore();
  });

  it('model = mock-low-cost-image → SVG fallback même sans mode set', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'openai');
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'mock model id',
      size: '1024x1024',
      quality: 'low',
      model: 'mock-low-cost-image',
    });
    expect(result.provider).toBe('mock');
  });

  it('mode=live + hf-* model sans API key → erreur explicite', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'openai');
    vi.stubEnv('AI_ENGINE_HIGGSFIELD_API_KEY', '');
    const { generateStudioImage } = await import('./image-generation');
    await expect(
      generateStudioImage({
        prompt: 'test',
        size: '1024x1024',
        quality: 'low',
        model: 'hf-flux-pro',
        mode: 'live',
      }),
    ).rejects.toThrow(/credential Higgsfield incomplet/);
  });

  it('mode=live + hf-flux-1 → POST vers /v1/images/generate avec le bon modèle', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'openai');
    vi.stubEnv('AI_ENGINE_HIGGSFIELD_API_KEY', 'hf_test_key:hf_secret');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.includes('/v1/images/generate')) {
        const body = JSON.parse(((init as RequestInit | undefined)?.body ?? '{}') as string);
        expect(body.model).toBe('flux-1');
        expect(body.prompt).toBe('test prompt HF');
        const pngB64 = await tinyPngBase64();
        return new Response(
          JSON.stringify({ images: [{ base64: pngB64 }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected fetch ${u}`);
    });
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'test prompt HF',
      size: '1024x1024',
      quality: 'medium',
      model: 'hf-flux-1',
      mode: 'live',
    });
    expect(result.provider).toBe('higgsfield');
    expect(result.model).toBe('hf-flux-1');
    expect(result.estimatedCostCents).toBe(250);
    fetchSpy.mockRestore();
  });

  it('mode=live + hf-flux-pro envoie le modèle Higgsfield correct', async () => {
    vi.stubEnv('AI_ENGINE_HIGGSFIELD_API_KEY', 'hf_test_key:hf_secret');
    const pngB64 = await tinyPngBase64();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(((init as RequestInit | undefined)?.body ?? '{}') as string);
      expect(body.model).toBe('flux-pro');
      return new Response(
        JSON.stringify({ images: [{ base64: pngB64 }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'p',
      size: '1024x1024',
      quality: 'high',
      model: 'hf-flux-pro',
      mode: 'live',
    });
    expect(result.estimatedCostCents).toBe(550);
    fetchSpy.mockRestore();
  });
});
