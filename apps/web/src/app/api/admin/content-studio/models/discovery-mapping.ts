import {
  findModelById,
  type ModelEntry,
  type ModelRole,
  type ModelSource,
} from '@/lib/content-studio-v2/models/registry';
import type { ContentFormat } from '@/lib/content-studio/types';
import type { DiscoverableProvider } from '@/lib/ai-engine/services/model-discovery';

// Helpers extracted out of `route.ts`: Next.js App Router route files may only
// export HTTP handlers + a fixed set of config fields, so these live in a
// sibling module the route (and the tests) import from.

// Providers we expose in the Content Studio v2 picker. Discovery is attempted
// for each; static-registry models stay visible as fallback.
export const DISCOVERY_PROVIDERS: Array<DiscoverableProvider> = ['openai', 'higgsfield', 'anthropic'];

export const PROVIDER_MAP: Record<DiscoverableProvider, ModelEntry['provider'] | null> = {
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
