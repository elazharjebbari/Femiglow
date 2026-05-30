import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listModels,
  listProviders,
  suggestForFormat,
  type ModelEntry,
  type ModelRole,
} from '@/lib/content-studio-v2/models/registry';
import { CONTENT_FORMATS, type ContentFormat } from '@/lib/content-studio/types';
import { resolveApiKey } from '@/lib/ai-engine/services/api-key-manager';
import { discoverModels } from '@/lib/ai-engine/services/model-discovery';
import {
  DISCOVERY_PROVIDERS,
  PROVIDER_MAP,
  discoveryRoleToStudio,
  materialiseDiscoveredModel,
} from './discovery-mapping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  role: z.enum(['chat', 'image', 'video']),
  format: z.enum(CONTENT_FORMATS).optional(),
});

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

