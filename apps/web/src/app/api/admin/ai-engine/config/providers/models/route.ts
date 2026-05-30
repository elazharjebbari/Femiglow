import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { resolveApiKey } from '@/lib/ai-engine/services/api-key-manager';
import {
  discoverModels,
  type DiscoverableProvider,
  type ModelEntry,
} from '@/lib/ai-engine/services/model-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Valid provider types accepted by this endpoint
// ---------------------------------------------------------------------------

const VALID_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'elevenlabs',
  'ollama',
  'runway',
  'stability',
  'higgsfield',
] as const);

type ProviderParam = typeof VALID_PROVIDERS extends Set<infer T> ? T : never;

// ---------------------------------------------------------------------------
// Map AI Engine provider types to model-discovery provider names
// ---------------------------------------------------------------------------

const PROVIDER_TO_DISCOVERY: Partial<Record<string, DiscoverableProvider>> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'gemini',
  ollama: 'ollama',
  higgsfield: 'higgsfield',
};

// ---------------------------------------------------------------------------
// Hardcoded fallbacks for providers without a model-listing API
// ---------------------------------------------------------------------------

const ELEVENLABS_MODELS: ModelEntry[] = [
  { id: 'eleven_multilingual_v2', role: 'tts' },
  { id: 'eleven_turbo_v2_5', role: 'tts' },
  { id: 'eleven_monolingual_v1', role: 'tts' },
];

const RUNWAY_MODELS: ModelEntry[] = [
  { id: 'gen-3-alpha', role: 'image' },
  { id: 'gen-3-alpha-turbo', role: 'image' },
];

const STABILITY_MODELS: ModelEntry[] = [
  { id: 'stable-diffusion-xl-1024-v1-0', role: 'image' },
  { id: 'stable-diffusion-v1-6', role: 'image' },
  { id: 'stable-image-core-v1', role: 'image' },
];

const HIGGSFIELD_MODELS: ModelEntry[] = [
  { id: 'flux_2', role: 'image' },
  { id: 'flux_kontext', role: 'image' },
  { id: 'cinematic_studio_2_5', role: 'image' },
  { id: 'image_auto', role: 'image' },
  { id: 'gpt_image_2', role: 'image' },
  { id: 'text2image_soul_v2', role: 'image' },
  { id: 'cinematic_studio_3_0', role: 'video' },
  { id: 'veo3_1', role: 'video' },
  { id: 'kling3_0', role: 'video' },
  { id: 'wan2_7', role: 'video' },
  { id: 'seedance_2_0', role: 'video' },
  { id: 'minimax_hailuo', role: 'video' },
  { id: 'marketing_studio_video', role: 'video' },
];

const STATIC_FALLBACKS: Record<string, ModelEntry[]> = {
  elevenlabs: ELEVENLABS_MODELS,
  runway: RUNWAY_MODELS,
  stability: STABILITY_MODELS,
  higgsfield: HIGGSFIELD_MODELS,
};

// ---------------------------------------------------------------------------
// Popular-model priority maps (lower index = higher priority)
// ---------------------------------------------------------------------------

const POPULAR_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'o3-mini',
    'dall-e-3',
    'text-embedding-3-small',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250514',
    'claude-opus-4-20250514',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ],
  ollama: [
    'glm-5.1:cloud',
    'llama3.1:8b',
    'qwen2.5',
    'mistral',
  ],
  higgsfield: [
    'flux_2',
    'flux_kontext',
    'cinematic_studio_2_5',
    'image_auto',
    'cinematic_studio_3_0',
    'veo3_1',
    'kling3_0',
    'wan2_7',
  ],
};

// ---------------------------------------------------------------------------
// Capability alias map ('text' in the query maps to 'chat' role)
// ---------------------------------------------------------------------------

const CAPABILITY_TO_ROLE: Record<string, ModelEntry['role']> = {
  text: 'chat',
  chat: 'chat',
  embedding: 'embedding',
  image: 'image',
  video: 'video',
  tts: 'tts',
  vision: 'vision',
  code: 'code',
};

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortModels(models: ModelEntry[], provider: string): ModelEntry[] {
  const priorityList = POPULAR_MODELS[provider] ?? [];
  const priorityMap = new Map<string, number>();
  for (let i = 0; i < priorityList.length; i++) {
    const modelId = priorityList[i];
    if (modelId !== undefined) {
      priorityMap.set(modelId, i);
    }
  }

  return [...models].sort((a, b) => {
    const pa = priorityMap.get(a.id);
    const pb = priorityMap.get(b.id);

    // Both in priority list: order by index
    if (pa !== undefined && pb !== undefined) return pa - pb;
    // Only a in priority list: a first
    if (pa !== undefined) return -1;
    // Only b in priority list: b first
    if (pb !== undefined) return 1;
    // Neither in priority list: alphabetical
    return a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdminApi();

    // --- Parse & validate provider ---
    const providerParam = req.nextUrl.searchParams.get('provider');
    if (!providerParam) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Missing required query parameter: provider' } },
        { status: 400 },
      );
    }

    if (!VALID_PROVIDERS.has(providerParam as ProviderParam)) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_input',
            message: `Invalid provider: "${providerParam}". Must be one of: ${[...VALID_PROVIDERS].join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    const provider = providerParam as ProviderParam;

    // --- Parse optional capability filter ---
    const capabilityParam = req.nextUrl.searchParams.get('capability');
    const roleFilter = capabilityParam
      ? CAPABILITY_TO_ROLE[capabilityParam] ?? null
      : null;

    // --- Static-fallback providers (no live discovery) ---
    const staticModels = STATIC_FALLBACKS[provider];
    if (staticModels) {
      let models = staticModels;
      if (roleFilter) {
        models = models.filter((m) => m.role === roleFilter);
      }
      return NextResponse.json(
        { models: sortModels(models, provider), source: 'fallback' as const },
        { headers: { 'Cache-Control': 'private, max-age=60' } },
      );
    }

    // --- Resolve API key server-side ---
    const apiKey = await resolveApiKey(provider);
    const discoveryProvider = PROVIDER_TO_DISCOVERY[provider];

    if (!discoveryProvider) {
      // Should not happen given validation above, but guard anyway
      return NextResponse.json(
        { error: { code: 'invalid_input', message: `No discovery support for provider: ${provider}` } },
        { status: 400 },
      );
    }

    // --- Build discovery options ---
    let result;

    if (provider === 'ollama') {
      const ollamaBaseUrl =
        process.env.AI_ENGINE_OLLAMA_BASE_URL ??
        process.env.CHAT_OLLAMA_BASE_URL ??
        'http://localhost:11434';

      result = await discoverModels('ollama', {
        apiBase: ollamaBaseUrl,
        authToken: apiKey,
      });
    } else {
      result = await discoverModels(discoveryProvider, { apiKey });
    }

    // --- Filter by capability ---
    let models = result.models;
    if (roleFilter) {
      models = models.filter((m) => m.role === roleFilter);
    }

    // --- Sort ---
    const sortKey = discoveryProvider;
    models = sortModels(models, sortKey);

    return NextResponse.json(
      { models, source: result.source },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
