import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listModels,
  listProviders,
  suggestForFormat,
  findModelById,
  type ModelEntry,
  type ModelRole,
  type ModelSource,
} from '@/lib/content-studio-v2/models/registry';
import { CONTENT_FORMATS, type ContentFormat } from '@/lib/content-studio/types';
import { resolveApiKey } from '@/lib/ai-engine/services/api-key-manager';
import {
  discoverModels,
  type DiscoverableProvider,
} from '@/lib/ai-engine/services/model-discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  role: z.enum(['chat', 'image', 'video']),
  format: z.enum(CONTENT_FORMATS).optional(),
});

// Providers we expose in the Content Studio v2 picker. Discovery is attempted
// for each; static-registry models stay visible as fallback.
const DISCOVERY_PROVIDERS: Array<DiscoverableProvider> = ['openai', 'higgsfield', 'anthropic'];

const PROVIDER_MAP: Record<DiscoverableProvider, ModelEntry['provider'] | null> = {
  openai: 'openai',
  anthropic: 'anthropic',
  higgsfield: 'higgsfield',
  gemini: 'google',
  mistral: null,
  qwen: null,
  deepseek: null,
  zhipu: null,
  'azure-openai': null,
  ollama: null,
};

/**
 * Map a discovered model id to the Content Studio role. Discovery's role uses
 * a wider taxonomy (chat/embedding/vision/image/tts/code/video) — we only keep
 * chat / image / video for the studio.
 */
export function discoveryRoleToStudio(role: string): ModelRole | null {
  if (role === 'chat' || role === 'image' || role === 'video') return role;
  return null;
}

/**
 * ACT-ARC-008 (BUG-024) — `discoverModels` renvoie `live | cache | fallback` ;
 * le registre ne connaît que `static | cache | live`. Un provider tombé en
 * FALLBACK (ex. host Higgsfield mort) NE DOIT PAS être badgé « Live » : ses
 * modèles proviennent de la liste statique → `static`, jamais `live`.
 */
export function mapDiscoverySource(discoverySource: string): ModelSource {
  if (discoverySource === 'live') return 'live';
  if (discoverySource === 'cache') return 'cache';
  return 'static';
}

/**
 * Materialise a "live-discovered" model into a ModelEntry compatible with the
 * studio registry. If the static registry already knows this id, prefer its
 * curated metadata (tier, pricing, recommendedFor). Otherwise, return a
 * minimal entry with sensible defaults and `source='live'` so the UI can flag
 * it as "Live".
 */
export function materialiseDiscoveredModel(
  discovered: { id: string; role: string },
  provider: ModelEntry['provider'],
  format: ContentFormat | null,
  discoverySource: string,
): ModelEntry | null {
  const studioRole = discoveryRoleToStudio(discovered.role);
  if (!studioRole) return null;
  // ACT-ARC-008 : la source réelle de la découverte (et non un 'live' forcé).
  const source = mapDiscoverySource(discoverySource);
  const known = findModelById(discovered.id);
  if (known) {
    // Keep curated metadata but reflect the true discovery source.
    return { ...known, source };
  }
  // Unknown discovered model — produce a sensible default entry.
  const tier: ModelEntry['tier'] = inferTierFromId(discovered.id);
  const recommended: ContentFormat[] = format ? [format] : [];
  return {
    id: discovered.id,
    provider,
    role: studioRole,
    label: humanizeModelId(discovered.id),
    description: `Modèle ${provider} découvert (${source}).`,
    tier,
    capabilities: [],
    pricing: { perCall: undefined },
    recommendedFor: recommended,
    source,
  };
}

function inferTierFromId(id: string): ModelEntry['tier'] {
  if (/mini|nano|haiku|fast|turbo|schnell|lite/i.test(id)) return 'fast';
  if (/pro|opus|max|ultra/i.test(id)) return 'premium';
  return 'balanced';
}

function humanizeModelId(id: string): string {
  // gpt-4o-mini → GPT 4o mini
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\bgpt\b/gi, 'GPT')
    .replace(/\b(\w)/g, (m) => m.toUpperCase());
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      role: searchParams.get('role') ?? undefined,
      format: searchParams.get('format') ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Paramètres invalides.', parsed.error.flatten());
    }
    const { role, format } = parsed.data;

    // 1. Start from the curated static registry (filtered by role).
    const staticModels = listModels(role as ModelRole);

    // 2. Try live discovery in parallel for each known provider. Failures fall
    //    back to whatever cached/static models that provider had.
    const discoveryResults = await Promise.all(
      DISCOVERY_PROVIDERS.map(async (prov) => {
        try {
          const apiKey = await resolveApiKey(prov);
          if (!apiKey) return { provider: prov, models: [], source: 'no-key' as const };
          const result = await discoverModels(prov, { apiKey });
          return { provider: prov, models: result.models, source: result.source };
        } catch {
          return { provider: prov, models: [], source: 'error' as const };
        }
      }),
    );

    // 3. Materialise discovered models that match the requested role.
    const liveModels: ModelEntry[] = [];
    const providerSourceMap: Record<string, string> = {};
    for (const r of discoveryResults) {
      providerSourceMap[r.provider] = r.source;
      const studioProvider = PROVIDER_MAP[r.provider];
      if (!studioProvider) continue;
      for (const m of r.models) {
        const role2 = discoveryRoleToStudio(m.role);
        if (role2 !== role) continue;
        const mat = materialiseDiscoveredModel(m, studioProvider, format ?? null, r.source);
        if (mat) liveModels.push(mat);
      }
    }

    // 4. Merge: live entries take precedence (by id) over static, but static
    //    entries not present in the live list are kept (mock-*, hf-video-* if
    //    Higgsfield discovery doesn't expose them, etc.).
    const seen = new Set<string>();
    const merged: ModelEntry[] = [];
    for (const m of [...liveModels, ...staticModels]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      merged.push(m);
    }

    // 5. Suggestion : prefer the registry's curated suggestion, fall back to
    //    the first model in the merged list.
    const suggestion = format ? suggestForFormat(format as ContentFormat) : null;
    const suggested =
      suggestion?.[role as ModelRole] ??
      merged.find((m) => m.isDefault) ??
      merged[0] ??
      null;

    return NextResponse.json({
      models: merged,
      suggested,
      providers: listProviders(),
      discovery: providerSourceMap,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

