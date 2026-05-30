import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { server, http, HttpResponse } from '@/test/msw/server';

async function tinyPngBase64(): Promise<string> {
  const buf = await sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  return buf.toString('base64');
}

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const HIGGSFIELD_IMAGE_RE = /\/v1\/images\/generate/;

// ARC-004 — appels providers interceptés par MSW (au lieu de spy sur fetch).
// server.listen idempotent (test/msw/server.ts). onUnhandledRequest:'error' :
// les chemins mock/no-key NE font aucun fetch (sinon MSW lèverait).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk_test_openai');
    const pngB64 = await tinyPngBase64();
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post(OPENAI_IMAGES_URL, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: [{ b64_json: pngB64 }] });
      }),
    );
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
    // Critical : le modèle SÉLECTIONNÉ est envoyé, pas l'env default.
    expect(captured!.model).toBe('gpt-image-1');
  });

  it('mode=live + modèle OpenAI sans AUCUNE clé OpenAI résolue → erreur explicite', async () => {
    vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
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
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post(OPENAI_IMAGES_URL, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: [{ b64_json: pngB64 }] });
      }),
    );
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'dall-e',
      size: '1024x1024',
      quality: 'medium',
      model: 'dall-e-3',
      mode: 'live',
    });
    expect(result.model).toBe('dall-e-3');
    expect(captured!.model).toBe('dall-e-3');
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
    const pngB64 = await tinyPngBase64();
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post(HIGGSFIELD_IMAGE_RE, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ images: [{ base64: pngB64 }] });
      }),
    );
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
    expect(captured!.model).toBe('flux-1');
    expect(captured!.prompt).toBe('test prompt HF');
  });

  it('mode=live + hf-flux-pro envoie le modèle Higgsfield correct', async () => {
    vi.stubEnv('AI_ENGINE_HIGGSFIELD_API_KEY', 'hf_test_key:hf_secret');
    const pngB64 = await tinyPngBase64();
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.post(HIGGSFIELD_IMAGE_RE, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ images: [{ base64: pngB64 }] });
      }),
    );
    const { generateStudioImage } = await import('./image-generation');
    const result = await generateStudioImage({
      prompt: 'p',
      size: '1024x1024',
      quality: 'high',
      model: 'hf-flux-pro',
      mode: 'live',
    });
    expect(result.estimatedCostCents).toBe(550);
    expect(captured!.model).toBe('flux-pro');
  });
});
