import { createLogger } from '../utils/logger';
import { getEngineConfig } from '../config';
import { ProviderSelector } from '../providers/selector';
import type { ProviderConfig } from '../providers/types';
import { resolveApiKey } from '../services/api-key-manager';

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

async function buildProviderConfigs(config: ReturnType<typeof getEngineConfig>): Promise<ProviderConfig[]> {
  const configs: ProviderConfig[] = [];
  const providers = [
    { type: 'openai', capability: 'image', priority: 10 },
    { type: 'higgsfield', capability: 'image', priority: 15 },
    { type: 'google', capability: 'image', priority: 30 },
  ] as const;

  for (const p of providers) {
    const apiKey = await resolveApiKey(p.type);
    if (!apiKey) continue;
    configs.push({
      id: `runtime-${p.type}`,
      type: p.type,
      name: p.type,
      apiKeyEnvVar: `AI_ENGINE_${p.type.toUpperCase()}_API_KEY`,
      capabilities: [p.capability],
      models: [],
      rateLimitRpm: 60,
      dailyBudgetCents: config.budget.dailyCents,
      circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
      priority: p.priority,
      isFallback: p.priority > 10,
      isEnabled: true,
      healthStatus: 'healthy',
    });
  }
  return configs;
}

async function generateProviderImage(
  prompt: string,
  width: number,
  height: number,
  index: number,
  config: ReturnType<typeof getEngineConfig>,
): Promise<MediaAsset> {
  const providerConfigs = await buildProviderConfigs(config);
  if (providerConfigs.length === 0) throw new Error('No image provider configured');

  const selector = new ProviderSelector(providerConfigs);
  const adapter = selector.selectProvider('generate_images', 'image');

  const result = await adapter.generateImage({
    model: config.providers.image.model,
    prompt,
    width,
    height,
    count: 1,
  });

  const imageUrl = result.data.images[0]?.url ?? result.data.images[0]?.base64 ?? '';

  return {
    assetId: `${adapter.name}-img-${Date.now()}-${index}`,
    url: imageUrl,
    mimeType: 'image/png',
    width,
    height,
    provider: `${adapter.name}:${config.providers.image.model}`,
    costCents: result.costCents,
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
      if (config.providers.image.default === 'mock') {
        images.push(generateMockImage(i, platformSpec.width, platformSpec.height));
      } else {
        const asset = await generateProviderImage(
          prompt,
          platformSpec.width,
          platformSpec.height,
          i,
          config,
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
