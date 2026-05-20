import { env } from '@/lib/env';
import sharp from 'sharp';

export interface GenerateStudioImageInput {
  prompt: string;
  size: '1024x1024' | '1024x1536' | '1536x1024';
  quality: 'low' | 'medium' | 'high';
}

export interface GeneratedStudioImage {
  buffer: Buffer;
  mime: 'image/png';
  provider: 'mock' | 'openai';
  model: string;
  usage: Record<string, unknown>;
  estimatedCostCents: number;
}

export async function generateStudioImage(
  input: GenerateStudioImageInput,
): Promise<GeneratedStudioImage> {
  if (env.CONTENT_STUDIO_IMAGE_PROVIDER === 'mock') {
    return generateMockStudioImage(input);
  }

  if (!env.CONTENT_STUDIO_OPENAI_API_KEY) {
    throw new Error('CONTENT_STUDIO_OPENAI_API_KEY manquant');
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.CONTENT_STUDIO_OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.CONTENT_STUDIO_IMAGE_MODEL,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      n: 1,
    }),
  });
  const json = (await res.json().catch(async () => ({ raw: await res.text().catch(() => '') }))) as {
    data?: Array<{ b64_json?: string }>;
    usage?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `OpenAI image generation failed: HTTP ${res.status}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('Réponse image OpenAI invalide : b64_json manquant');
  return {
    buffer: Buffer.from(b64, 'base64'),
    mime: 'image/png',
    provider: 'openai',
    model: env.CONTENT_STUDIO_IMAGE_MODEL,
    usage: json.usage ?? {},
    estimatedCostCents: estimateOpenAiImageCostCents(input.quality),
  };
}

async function generateMockStudioImage(input: GenerateStudioImageInput): Promise<GeneratedStudioImage> {
  const { width, height } = parseSize(input.size);
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fbf7f1"/>
          <stop offset="0.52" stop-color="#f6d7cf"/>
          <stop offset="1" stop-color="#e8efe5"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="${width * 0.22}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.12}" fill="#8f3f4a" opacity="0.16"/>
      <rect x="${width * 0.16}" y="${height * 0.18}" width="${width * 0.68}" height="${height * 0.64}" rx="${Math.min(width, height) * 0.035}" fill="#fffaf5" opacity="0.86"/>
      <path d="M ${width * 0.28} ${height * 0.58} C ${width * 0.4} ${height * 0.46}, ${width * 0.56} ${height * 0.46}, ${width * 0.72} ${height * 0.58}" fill="none" stroke="#2f2a26" stroke-width="${Math.max(8, width * 0.012)}" stroke-linecap="round" opacity="0.52"/>
      <circle cx="${width * 0.5}" cy="${height * 0.43}" r="${Math.min(width, height) * 0.075}" fill="#c98d75" opacity="0.58"/>
      <rect x="${width * 0.35}" y="${height * 0.66}" width="${width * 0.3}" height="${height * 0.035}" rx="${height * 0.018}" fill="#2f2a26" opacity="0.28"/>
    </svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    buffer,
    mime: 'image/png',
    provider: 'mock',
    model: 'mock-low-cost-image',
    usage: {
      mode: 'mock',
      promptLength: input.prompt.length,
      size: input.size,
      quality: input.quality,
    },
    estimatedCostCents: 0,
  };
}

function parseSize(size: GenerateStudioImageInput['size']): { width: number; height: number } {
  const [width, height] = size.split('x').map((value) => Number(value));
  return { width: width || 1024, height: height || 1024 };
}

function estimateOpenAiImageCostCents(quality: GenerateStudioImageInput['quality']): number {
  if (env.CONTENT_STUDIO_IMAGE_MODEL === 'gpt-image-1-mini') {
    if (quality === 'high') return 4;
    if (quality === 'medium') return 2;
    return 1;
  }
  if (quality === 'high') return 22;
  if (quality === 'medium') return 6;
  return 1;
}
