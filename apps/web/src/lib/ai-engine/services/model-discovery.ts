/**
 * Shared model-discovery service for the AI Engine.
 *
 * Extracted from the chat module's provider/models route (CHA-115b) so both
 * the chat admin UI and the AI Engine config UI can discover models without
 * duplicating fetcher logic.
 *
 * Enhancements over the original inline code:
 *  - In-memory cache with 5-minute TTL per provider
 *  - `discoverModels()` orchestrator that encapsulates caching + fallback
 *  - `invalidateModelCache()` for external cache control
 *  - `fetchOllama` accepts an optional `authToken` for authenticated Ollama endpoints
 */

import { createLogger } from '../utils/logger';

const log = createLogger('services:model-discovery');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscoverableProvider =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'azure-openai'
  | 'ollama'
  | 'higgsfield';

export interface ModelEntry {
  id: string;
  role: 'chat' | 'embedding' | 'vision' | 'image' | 'tts' | 'code' | 'video';
}

export interface DiscoveryResult {
  models: ModelEntry[];
  source: 'live' | 'cache' | 'fallback';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 5_000;
export const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

/** Curated static list — always returned when live fetch fails. */
export const FALLBACK_MODELS: Record<DiscoverableProvider, ModelEntry[]> = {
  openai: [
    { id: 'gpt-4o-mini', role: 'chat' },
    { id: 'gpt-4o', role: 'chat' },
    { id: 'gpt-4.1-mini', role: 'chat' },
    { id: 'gpt-4.1', role: 'chat' },
    { id: 'gpt-4-turbo', role: 'chat' },
    { id: 'o1-mini', role: 'chat' },
    { id: 'o1', role: 'chat' },
    { id: 'text-embedding-3-small', role: 'embedding' },
    { id: 'text-embedding-3-large', role: 'embedding' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-latest', role: 'chat' },
    { id: 'claude-3-5-haiku-latest', role: 'chat' },
    { id: 'claude-3-opus-latest', role: 'chat' },
    { id: 'claude-sonnet-4-5', role: 'chat' },
  ],
  mistral: [
    { id: 'mistral-large-latest', role: 'chat' },
    { id: 'mistral-small-latest', role: 'chat' },
    { id: 'open-mistral-nemo', role: 'chat' },
    { id: 'mistral-embed', role: 'embedding' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', role: 'chat' },
    { id: 'gemini-2.0-flash-lite', role: 'chat' },
    { id: 'gemini-1.5-pro', role: 'chat' },
    { id: 'gemini-1.5-flash', role: 'chat' },
    { id: 'text-embedding-004', role: 'embedding' },
  ],
  qwen: [
    { id: 'qwen-max', role: 'chat' },
    { id: 'qwen-plus', role: 'chat' },
    { id: 'qwen-turbo', role: 'chat' },
    { id: 'text-embedding-v3', role: 'embedding' },
  ],
  deepseek: [
    { id: 'deepseek-chat', role: 'chat' },
    { id: 'deepseek-reasoner', role: 'chat' },
  ],
  zhipu: [
    { id: 'glm-4-plus', role: 'chat' },
    { id: 'glm-4-air', role: 'chat' },
    { id: 'glm-4-flash', role: 'chat' },
    { id: 'embedding-3', role: 'embedding' },
  ],
  'azure-openai': [
    { id: 'gpt-4o', role: 'chat' },
    { id: 'gpt-4o-mini', role: 'chat' },
    { id: 'gpt-4', role: 'chat' },
    { id: 'text-embedding-3-small', role: 'embedding' },
    { id: 'text-embedding-3-large', role: 'embedding' },
  ],
  ollama: [
    { id: 'glm-5.1:cloud', role: 'chat' },
    { id: 'llama3.2', role: 'chat' },
    { id: 'llama3.1', role: 'chat' },
    { id: 'qwen2.5', role: 'chat' },
    { id: 'mistral', role: 'chat' },
    { id: 'nomic-embed-text', role: 'embedding' },
    { id: 'mxbai-embed-large', role: 'embedding' },
  ],
  higgsfield: [
    { id: 'flux_2', role: 'image' },
    { id: 'flux_kontext', role: 'image' },
    { id: 'cinematic_studio_2_5', role: 'image' },
    { id: 'text2image_soul_v2', role: 'image' },
    { id: 'gpt_image_2', role: 'image' },
    { id: 'seedream_v5_lite', role: 'image' },
    { id: 'nano_banana_2', role: 'image' },
    { id: 'image_auto', role: 'image' },
    { id: 'cinematic_studio_3_0', role: 'video' },
    { id: 'veo3_1', role: 'video' },
    { id: 'kling3_0', role: 'video' },
    { id: 'wan2_7', role: 'video' },
    { id: 'seedance_2_0', role: 'video' },
    { id: 'minimax_hailuo', role: 'video' },
    { id: 'marketing_studio_video', role: 'video' },
    { id: 'soul_cast', role: 'video' },
  ],
};

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  models: ModelEntry[];
  source: 'live' | 'fallback';
  expiresAt: number;
}

const modelCache = new Map<string, CacheEntry>();

/**
 * Invalidate cached model lists.
 * @param provider — if provided, only that provider's cache is cleared;
 *                    otherwise all providers are cleared.
 */
export function invalidateModelCache(provider?: DiscoverableProvider): void {
  if (provider) {
    modelCache.delete(provider);
  } else {
    modelCache.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Heuristic: infer a model's role from its id. */
export function inferRole(id: string): ModelEntry['role'] {
  if (/embed|embedding/i.test(id)) return 'embedding';
  // Non-génératifs / hors-chat (ACT-ARC-008, BUG-016/019) : modération et
  // STT/audio (whisper, transcribe, realtime) ne doivent JAMAIS apparaître en
  // role=chat dans le picker. Classés ici pour être filtrés en aval par
  // discoveryRoleToStudio (qui ne garde que chat/image/video).
  if (/moderation/i.test(id)) return 'embedding';
  if (/whisper|transcrib|realtime/i.test(id)) return 'tts';
  if (/video/i.test(id)) return 'video';
  if (/image|diffusion|dall-?e|stable|xl/i.test(id)) return 'image';
  if (/tts|speech|audio/i.test(id)) return 'tts';
  return 'chat';
}

/**
 * Merge two model lists, deduplicating by id.
 * `primary` entries take precedence over `fallback`.
 */
export function dedupeMerge(primary: ModelEntry[], fallback: ModelEntry[]): ModelEntry[] {
  const seen = new Set<string>();
  const out: ModelEntry[] = [];
  for (const m of [...primary, ...fallback]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/**
 * `fetch` wrapper that aborts after `FETCH_TIMEOUT_MS` (5 s).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Provider fetchers
// ---------------------------------------------------------------------------

export async function fetchOpenAI(apiKey: string, apiBase?: string): Promise<ModelEntry[]> {
  const base = apiBase?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
  const res = await fetchWithTimeout(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: inferRole(m.id) }));
}

export async function fetchAnthropic(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: 'chat' as const }));
}

export async function fetchMistral(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`mistral ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: inferRole(m.id) }));
}

export async function fetchGemini(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: 'GET' },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const json = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };
  return (json.models ?? []).map((m) => {
    const id = m.name.replace(/^models\//, '');
    const supports = m.supportedGenerationMethods ?? [];
    const role: 'chat' | 'embedding' = supports.includes('embedContent')
      ? 'embedding'
      : 'chat';
    return { id, role };
  });
}

export async function fetchDeepseek(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.deepseek.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: 'chat' as const }));
}

/**
 * Fetch models from an Ollama instance.
 *
 * @param apiBase — base URL of the Ollama server (e.g. `http://localhost:11434`)
 * @param authToken — optional Bearer token for authenticated endpoints.
 *                     Only sent when non-empty and not already a URL.
 */
export async function fetchOllama(apiBase: string, authToken?: string): Promise<ModelEntry[]> {
  const base = apiBase.replace(/\/$/, '');
  const headers: Record<string, string> = {};
  if (authToken && !authToken.startsWith('http')) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetchWithTimeout(`${base}/api/tags`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const json = (await res.json()) as { models?: Array<{ name: string }> };
  return (json.models ?? []).map((m) => ({ id: m.name, role: inferRole(m.name) }));
}

export async function fetchHiggsfield(apiKey: string, apiBase?: string): Promise<ModelEntry[]> {
  const base = apiBase?.replace(/\/$/, '') ?? 'https://api.higgsfield.ai/v1';
  const res = await fetchWithTimeout(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`higgsfield ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string; type?: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: inferRole(m.id) }));
}

// ---------------------------------------------------------------------------
// Internal: pick the right fetcher for a provider
// ---------------------------------------------------------------------------

async function callFetcher(
  provider: DiscoverableProvider,
  opts: { apiKey?: string; apiBase?: string; authToken?: string },
): Promise<ModelEntry[] | null> {
  switch (provider) {
    case 'openai':
      if (!opts.apiKey) return null;
      return fetchOpenAI(opts.apiKey, opts.apiBase);
    case 'anthropic':
      if (!opts.apiKey) return null;
      return fetchAnthropic(opts.apiKey);
    case 'mistral':
      if (!opts.apiKey) return null;
      return fetchMistral(opts.apiKey);
    case 'gemini':
      if (!opts.apiKey) return null;
      return fetchGemini(opts.apiKey);
    case 'deepseek':
      if (!opts.apiKey) return null;
      return fetchDeepseek(opts.apiKey);
    case 'ollama':
      return fetchOllama(opts.apiBase ?? 'http://localhost:11434', opts.authToken);
    case 'higgsfield':
      if (!opts.apiKey) return null;
      return fetchHiggsfield(opts.apiKey, opts.apiBase);
    // qwen / zhipu / azure-openai: non-uniform APIs — static fallback only
    case 'qwen':
    case 'zhipu':
    case 'azure-openai':
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Discover models for a given provider.
 *
 * 1. If a valid cache entry exists → return immediately (`source: 'cache'`).
 * 2. Otherwise call the live provider API.
 *    - On success: merge with fallback via `dedupeMerge`, cache, return (`source: 'live'`).
 *    - On failure: return static fallback list (`source: 'fallback'`).
 */
export async function discoverModels(
  provider: DiscoverableProvider,
  opts: { apiKey?: string; apiBase?: string; authToken?: string } = {},
): Promise<DiscoveryResult> {
  // --- Cache check ---
  const cached = modelCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) {
    return { models: cached.models, source: 'cache' };
  }

  const fallback = FALLBACK_MODELS[provider] ?? [];

  // --- Live fetch ---
  let fetched: ModelEntry[] | null = null;
  try {
    fetched = await callFetcher(provider, opts);
  } catch (err) {
    log.warn('model discovery fetch failed', {
      provider,
      error: (err as Error).message,
    });
  }

  if (fetched && fetched.length > 0) {
    const merged = dedupeMerge(fetched, fallback);
    modelCache.set(provider, {
      models: merged,
      source: 'live',
      expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
    });
    return { models: merged, source: 'live' };
  }

  // --- Fallback ---
  return { models: fallback, source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Test helper — expose cache for assertions (only used in tests)
// ---------------------------------------------------------------------------

/** @internal — exported only for test introspection */
export const _modelCache = modelCache;
