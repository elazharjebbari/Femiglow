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
import {
  type DiscoverableProvider,
  discoverModels,
} from '@/lib/ai-engine/services/model-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS = new Set<DiscoverableProvider>([
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

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: { kind?: string; apiKey?: string; apiBase?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const kind = body.kind as DiscoverableProvider | undefined;
  if (!kind || !VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: 'invalid-kind' }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === 'string' && body.apiKey.length > 0 ? body.apiKey : undefined;
  const apiBase = typeof body.apiBase === 'string' && body.apiBase.length > 0 ? body.apiBase : undefined;

  const result = await discoverModels(kind, { apiKey, apiBase });

  // Map source to keep the original API contract: 'live' → 'fetch'
  const source = result.source === 'live' || result.source === 'cache' ? 'fetch' : 'fallback';

  return NextResponse.json({
    models: result.models,
    source,
  });
}
