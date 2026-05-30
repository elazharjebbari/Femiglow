import type { ContentFormat } from '@/lib/content-studio/types';

export type ModelRole = 'chat' | 'image' | 'video';
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'higgsfield' | 'mock';
export type ModelTier = 'fast' | 'balanced' | 'premium';
export type ModelSource = 'static' | 'cache' | 'live';

export interface ModelEntry {
  id: string;
  provider: ModelProvider;
  role: ModelRole;
  label: string;
  description?: string;
  tier: ModelTier;
  capabilities: string[];
  contextWindow?: number;
  pricing: {
    inputCentsPer1k?: number;
    outputCentsPer1k?: number;
    perCall?: number;
  };
  recommendedFor: ContentFormat[];
  source: ModelSource;
  isDefault?: boolean;
}

export interface ProviderInfo {
  id: ModelProvider;
  label: string;
  status: 'healthy' | 'degraded' | 'down' | 'mock';
}

export const MODELS: ReadonlyArray<ModelEntry> = [
  // — CHAT
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    role: 'chat',
    label: 'GPT-4o mini',
    description: 'Rapide, polyvalent, économique.',
    tier: 'fast',
    capabilities: ['function-calling', 'vision'],
    contextWindow: 128_000,
    pricing: { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 },
    recommendedFor: ['post', 'story'],
    source: 'static',
    isDefault: true,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    role: 'chat',
    label: 'GPT-4o',
    description: 'Équilibré, idéal contenus moyens-longs.',
    tier: 'balanced',
    capabilities: ['function-calling', 'vision'],
    contextWindow: 128_000,
    pricing: { inputCentsPer1k: 0.25, outputCentsPer1k: 1.0 },
    recommendedFor: ['reel', 'carousel'],
    source: 'static',
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    role: 'chat',
    label: 'Claude Sonnet 4.6',
    description: 'Premium, texte raffiné, fr natif.',
    tier: 'premium',
    capabilities: ['vision', 'fr', 'long-context'],
    contextWindow: 200_000,
    pricing: { inputCentsPer1k: 0.3, outputCentsPer1k: 1.5 },
    recommendedFor: ['carousel'],
    source: 'static',
  },

  // — IMAGE
  {
    id: 'gpt-image-1-mini',
    provider: 'openai',
    role: 'image',
    label: 'GPT-Image-1 mini',
    description: 'Image rapide, qualité moyenne.',
    tier: 'fast',
    capabilities: ['square', 'portrait'],
    pricing: { perCall: 0.4 },
    recommendedFor: ['story'],
    source: 'static',
    isDefault: true,
  },
  {
    id: 'dall-e-3',
    provider: 'openai',
    role: 'image',
    label: 'DALL·E 3',
    description: 'Image équilibrée, photoréaliste.',
    tier: 'balanced',
    capabilities: ['square', 'portrait', 'landscape'],
    pricing: { perCall: 4.0 },
    recommendedFor: ['post', 'carousel'],
    source: 'static',
  },
  {
    id: 'gpt-image-1',
    provider: 'openai',
    role: 'image',
    label: 'GPT-Image-1',
    description: 'Image premium, ratios verticaux.',
    tier: 'premium',
    capabilities: ['square', 'portrait', 'landscape', 'vertical-9x16'],
    pricing: { perCall: 8.0 },
    recommendedFor: ['reel'],
    source: 'static',
  },
  // — IMAGE · Higgsfield (Flux line)
  {
    id: 'hf-flux-schnell',
    provider: 'higgsfield',
    role: 'image',
    label: 'Flux Schnell',
    description: 'Higgsfield Flux Schnell — image très rapide, économique.',
    tier: 'fast',
    capabilities: ['square', 'portrait', 'landscape'],
    pricing: { perCall: 0.3 },
    recommendedFor: ['story'],
    source: 'static',
  },
  {
    id: 'hf-flux-1',
    provider: 'higgsfield',
    role: 'image',
    label: 'Flux.1',
    description: 'Higgsfield Flux.1 — équilibré, photoréaliste.',
    tier: 'balanced',
    capabilities: ['square', 'portrait', 'landscape', 'vertical-9x16'],
    pricing: { perCall: 2.5 },
    recommendedFor: ['post', 'carousel'],
    source: 'static',
  },
  {
    id: 'hf-flux-pro',
    provider: 'higgsfield',
    role: 'image',
    label: 'Flux Pro',
    description: 'Higgsfield Flux Pro — image premium, détails fins.',
    tier: 'premium',
    capabilities: ['square', 'portrait', 'landscape', 'vertical-9x16'],
    pricing: { perCall: 5.5 },
    recommendedFor: ['reel'],
    source: 'static',
  },

  // — VIDEO
  {
    id: 'mock-video-1.0',
    provider: 'mock',
    role: 'video',
    label: 'Mock vidéo (1.0)',
    description: 'Vidéo simulée — environnement mock (gratuit).',
    tier: 'fast',
    capabilities: ['vertical-9x16'],
    pricing: { perCall: 0 },
    recommendedFor: ['reel', 'story'],
    source: 'static',
    isDefault: true,
  },
  // — VIDEO · Higgsfield
  {
    id: 'hf-video-mini',
    provider: 'higgsfield',
    role: 'video',
    label: 'Higgsfield Mini',
    description: 'Vidéo courte (3-5s) très rapide, économique. Idéal A/B testing.',
    tier: 'fast',
    capabilities: ['vertical-9x16', 'duration-5s'],
    pricing: { perCall: 4.0 },
    recommendedFor: ['story'],
    source: 'static',
  },
  {
    id: 'hf-video-lite',
    provider: 'higgsfield',
    role: 'video',
    label: 'Higgsfield Lite',
    description: 'Vidéo 5s standard, bon rapport qualité/prix.',
    tier: 'fast',
    capabilities: ['vertical-9x16', 'duration-5s'],
    pricing: { perCall: 12.0 },
    recommendedFor: ['reel', 'story'],
    source: 'static',
  },
  {
    id: 'hf-video-standard',
    provider: 'higgsfield',
    role: 'video',
    label: 'Higgsfield Standard',
    description: 'Vidéo 5-10s qualité supérieure, mouvements fluides.',
    tier: 'balanced',
    capabilities: ['vertical-9x16', 'duration-10s'],
    pricing: { perCall: 28.0 },
    recommendedFor: ['reel'],
    source: 'static',
  },
  {
    id: 'hf-video-turbo',
    provider: 'higgsfield',
    role: 'video',
    label: 'Higgsfield Turbo',
    description: 'Vidéo premium 10s, rendu cinéma, détails fins.',
    tier: 'premium',
    capabilities: ['vertical-9x16', 'duration-10s'],
    pricing: { perCall: 65.0 },
    recommendedFor: ['reel'],
    source: 'static',
  },
];

const TIER_ORDER: Record<ModelTier, number> = { fast: 0, balanced: 1, premium: 2 };

const PROVIDER_LABEL: Record<ModelProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  higgsfield: 'Higgsfield',
  mock: 'Mock provider',
};

export function listModels(role: ModelRole): ModelEntry[] {
  return MODELS.filter((m) => m.role === role);
}

export function listChatModels(): ModelEntry[] {
  return listModels('chat');
}

export function listImageModels(): ModelEntry[] {
  return listModels('image');
}

export function listVideoModels(): ModelEntry[] {
  return listModels('video');
}

export interface FormatSuggestion {
  chat: ModelEntry | null;
  image: ModelEntry | null;
  video: ModelEntry | null;
}

function pickForFormat(role: ModelRole, format: ContentFormat): ModelEntry | null {
  const recommended = MODELS.filter((m) => m.role === role && m.recommendedFor.includes(format));
  if (recommended.length > 0) {
    return [...recommended].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])[0] ?? null;
  }
  return (
    MODELS.find((m) => m.role === role && m.isDefault) ??
    MODELS.find((m) => m.role === role) ??
    null
  );
}

export function suggestForFormat(format: ContentFormat): FormatSuggestion {
  return {
    chat: pickForFormat('chat', format),
    image: pickForFormat('image', format),
    video: pickForFormat('video', format),
  };
}

export function findModelById(id: string): ModelEntry | null {
  return MODELS.find((m) => m.id === id) ?? null;
}

export function listProviders(): ProviderInfo[] {
  const seen = new Set<ModelProvider>();
  const out: ProviderInfo[] = [];
  for (const m of MODELS) {
    if (seen.has(m.provider)) continue;
    seen.add(m.provider);
    out.push({
      id: m.provider,
      label: PROVIDER_LABEL[m.provider],
      status: m.provider === 'mock' ? 'mock' : 'healthy',
    });
  }
  return out;
}
