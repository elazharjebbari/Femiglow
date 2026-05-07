/**
 * CHA-115b — Découverte des modèles disponibles pour un provider.
 *
 * POST /api/admin/chat/providers/models
 * body: { kind: ProviderKind, apiKey?: string, apiBase?: string }
 * → { models: Array<{ id: string; role?: 'chat' | 'embedding' }>, source: 'fetch' | 'fallback' }
 *
 * Permet à l'UI admin (formulaire de création) d'auto-compléter le champ
 * "modèle" via un fetch à l'API du provider. Si l'appel échoue (clé absente,
 * 4xx/5xx, timeout), une liste statique curée est renvoyée.
 *
 * Aucun secret n'est persisté ni journalisé : la clé est utilisée le temps
 * d'un seul appel sortant et oubliée.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'zhipu'
  | 'azure-openai'
  | 'ollama';

type ModelEntry = { id: string; role?: 'chat' | 'embedding' };

const FETCH_TIMEOUT_MS = 5_000;

/** Liste statique curée — toujours retournée si le fetch échoue. */
const FALLBACK_MODELS: Record<ProviderKind, ModelEntry[]> = {
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
    { id: 'llama3.2', role: 'chat' },
    { id: 'llama3.1', role: 'chat' },
    { id: 'qwen2.5', role: 'chat' },
    { id: 'mistral', role: 'chat' },
    { id: 'nomic-embed-text', role: 'embedding' },
    { id: 'mxbai-embed-large', role: 'embedding' },
  ],
};

const VALID_KINDS = new Set<ProviderKind>([
  'openai',
  'anthropic',
  'mistral',
  'gemini',
  'qwen',
  'deepseek',
  'zhipu',
  'azure-openai',
  'ollama',
]);

/** Heuristique : un id ressemble à un modèle d'embedding ? */
function inferRole(id: string): 'chat' | 'embedding' {
  return /embed|embedding/i.test(id) ? 'embedding' : 'chat';
}

function dedupeMerge(primary: ModelEntry[], fallback: ModelEntry[]): ModelEntry[] {
  const seen = new Set<string>();
  const out: ModelEntry[] = [];
  for (const m of [...primary, ...fallback]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

async function fetchWithTimeout(
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

async function fetchOpenAI(apiKey: string, apiBase?: string): Promise<ModelEntry[]> {
  const base = apiBase?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';
  const res = await fetchWithTimeout(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: inferRole(m.id) }));
}

async function fetchAnthropic(apiKey: string): Promise<ModelEntry[]> {
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

async function fetchMistral(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.mistral.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`mistral ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: inferRole(m.id) }));
}

async function fetchGemini(apiKey: string): Promise<ModelEntry[]> {
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

async function fetchDeepseek(apiKey: string): Promise<ModelEntry[]> {
  const res = await fetchWithTimeout('https://api.deepseek.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((m) => ({ id: m.id, role: 'chat' as const }));
}

async function fetchOllama(apiBase: string): Promise<ModelEntry[]> {
  const base = apiBase.replace(/\/$/, '');
  const res = await fetchWithTimeout(`${base}/api/tags`, { method: 'GET' });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const json = (await res.json()) as { models?: Array<{ name: string }> };
  return (json.models ?? []).map((m) => ({ id: m.name, role: inferRole(m.name) }));
}

async function discover(
  kind: ProviderKind,
  apiKey?: string,
  apiBase?: string,
): Promise<ModelEntry[] | null> {
  try {
    switch (kind) {
      case 'openai':
        if (!apiKey) return null;
        return await fetchOpenAI(apiKey, apiBase);
      case 'anthropic':
        if (!apiKey) return null;
        return await fetchAnthropic(apiKey);
      case 'mistral':
        if (!apiKey) return null;
        return await fetchMistral(apiKey);
      case 'gemini':
        if (!apiKey) return null;
        return await fetchGemini(apiKey);
      case 'deepseek':
        if (!apiKey) return null;
        return await fetchDeepseek(apiKey);
      case 'ollama':
        return await fetchOllama(apiBase ?? 'http://localhost:11434');
      // qwen / zhipu / azure-openai : APIs non-uniformes, fallback statique
      case 'qwen':
      case 'zhipu':
      case 'azure-openai':
        return null;
      default:
        return null;
    }
  } catch (err) {
    logger.warn('chat.admin.providers_models_fetch_failed', {
      kind,
      error: (err as Error).message,
    });
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { kind?: string; apiKey?: string; apiBase?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const kind = body.kind as ProviderKind | undefined;
  if (!kind || !VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid-kind' }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === 'string' && body.apiKey.length > 0 ? body.apiKey : undefined;
  const apiBase = typeof body.apiBase === 'string' && body.apiBase.length > 0 ? body.apiBase : undefined;

  const fetched = await discover(kind, apiKey, apiBase);
  const fallback = FALLBACK_MODELS[kind] ?? [];

  if (fetched && fetched.length > 0) {
    return NextResponse.json({
      models: dedupeMerge(fetched, fallback),
      source: 'fetch' as const,
    });
  }
  return NextResponse.json({
    models: fallback,
    source: 'fallback' as const,
  });
}
