import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';

const log = createLogger('node:generate-images');

interface VisualNote {
  element: string;
  style: string;
  colors: string[];
  composition: string;
}

interface MediaAsset {
  assetId: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  provider: string;
  costCents: number;
}

const PLATFORM_SIZES: Record<string, Record<string, { width: number; height: number; size: string }>> = {
  instagram: {
    post: { width: 1080, height: 1080, size: '1024x1024' },
    story: { width: 1080, height: 1920, size: '1024x1792' },
    reel: { width: 1080, height: 1920, size: '1024x1792' },
    carousel: { width: 1080, height: 1080, size: '1024x1024' },
  },
  facebook: {
    post: { width: 1200, height: 1200, size: '1024x1024' },
    story: { width: 1080, height: 1920, size: '1024x1792' },
    reel: { width: 1080, height: 1920, size: '1024x1792' },
  },
  pinterest: {
    post: { width: 1000, height: 1500, size: '1024x1792' },
  },
};

function buildImagePrompt(note: VisualNote, brand: string): string {
  const parts = [
    'Professional beauty product photography for FemiGlow J-Beauty brand.',
    `Subject: ${note.element.replace(/_/g, ' ')}.`,
    `Style: ${note.style.replace(/_/g, ' ')}.`,
    `Color palette: ${note.colors.join(', ')}.`,
    `Composition: ${note.composition.replace(/_/g, ' ')}.`,
    'Aesthetic: minimal Japanese beauty, natural lighting, warm tones, cream and sage accents.',
    'No text overlay. No logos. No watermarks. Photorealistic.',
  ];
  if (brand) parts.push(`Brand context: ${brand.slice(0, 200)}`);
  return parts.join(' ');
}

function generateMockImage(index: number, width: number, height: number): MediaAsset {
  const id = `mock-img-${Date.now()}-${index}`;
  return {
    assetId: id,
    url: `/_media/ai-engine/mock/${id}.png`,
    mimeType: 'image/png',
    width,
    height,
    provider: 'mock',
    costCents: 0,
  };
}

async function generateOpenAIImage(
  prompt: string,
  size: string,
  index: number,
  apiKey: string,
  model: string,
): Promise<MediaAsset> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality: 'standard',
      response_format: 'url',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`);
    throw new Error(`OpenAI image generation failed: ${text}`);
  }

  const json = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error('No image URL in response');

  const [w, h] = size.split('x').map(Number);
  const costCents = size === '1024x1024' ? 4 : 8;

  return {
    assetId: `openai-img-${Date.now()}-${index}`,
    url,
    mimeType: 'image/png',
    width: w ?? 1024,
    height: h ?? 1024,
    provider: `openai:${model}`,
    costCents,
  };
}

export async function generateImagesNode(state: Record<string, unknown>): Promise<Record<string, unknown>> {
  const jobId = state.jobId as string;
  const config = getEngineConfig();
  const platform = state.platform as string;
  const format = state.format as string;
  const script = state.script as Record<string, unknown> | null;
  const brand = (state.brandGuidelines as string) ?? '';

  log.info('Generating images', { jobId, node: 'generate_images', provider: config.providers.image.default });

  const startTime = Date.now();
  const visualNotes = (script?.visualDirection as VisualNote[]) ?? [
    { element: 'product_hero', style: 'minimal_japanese', colors: ['cream', 'sage'], composition: 'centered' },
  ];

  const platformSpec = PLATFORM_SIZES[platform]?.[format] ?? PLATFORM_SIZES.instagram?.post ?? { width: 1024, height: 1024, size: '1024x1024' };
  const isCarousel = format === 'carousel';
  const imageCount = isCarousel ? Math.min(visualNotes.length, 5) : 1;

  const images: MediaAsset[] = [];
  let totalCost = 0;

  for (let i = 0; i < imageCount; i++) {
    const note = visualNotes[i % visualNotes.length]!;
    const prompt = buildImagePrompt(note, brand);

    try {
      if (config.providers.image.default === 'mock' || !config.apiKeys.openai) {
        images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
      } else {
        const asset = await generateOpenAIImage(
          prompt,
          platformSpec.size,
          i,
          config.apiKeys.openai,
          config.providers.image.model,
        );
        images.push(asset);
        totalCost += asset.costCents;
      }
    } catch (err) {
      log.warn(`Image ${i} generation failed, using mock`, { jobId, node: 'generate_images', data: { error: String(err) } });
      images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
    }
  }

  const durationMs = Date.now() - startTime;
  log.info('Images generated', {
    jobId,
    node: 'generate_images',
    durationMs,
    costCents: totalCost,
    data: { count: images.length },
  });

  const prevCost = state.costTracking as Record<string, unknown> | undefined;
  const prevTotal = (prevCost?.totalCents as number) ?? 0;
  const prevBreakdown = (prevCost?.breakdown as Record<string, number>) ?? {};

  return {
    images,
    currentStep: 'generate_images',
    costTracking: {
      ...prevCost,
      totalCents: prevTotal + totalCost,
      breakdown: { ...prevBreakdown, generate_images: totalCost },
    },
  };
}
