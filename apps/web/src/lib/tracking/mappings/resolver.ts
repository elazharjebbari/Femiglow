/**
 * resolveEventMapping — résolveur event → vendor avec cache + fallback.
 * cf. docs/event-mappings/30-backend/service-layer.md
 */
import { mapEventName } from '@/lib/tracking/providers/event-mapping';
import { getActiveMemoized, invalidateActiveCache } from './store';
import type { MappingCell, MappingProviderKind } from './types';

interface ResolvedMapping {
  mappedName: string;
  isCustom: boolean;
  notes: string | null;
}

const resolveCache = new Map<string, { value: ResolvedMapping | null; expiresAt: number }>();
const RESOLVE_TTL_MS = 30_000;

function cacheKey(eventName: string, kind: MappingProviderKind): string {
  return `${eventName}|${kind}`;
}

/**
 * Retourne le mapping pour (eventName, providerKind) avec fallback :
 * 1. DB version active → cellule correspondante
 * 2. Si DB vide / cellule absente / isEnabled=false / mappedName=null → null
 * 3. Si pas de DB du tout (memory mode) → fallback `event-mapping.ts` (code legacy)
 */
export async function resolveEventMapping(
  eventName: string,
  providerKind: MappingProviderKind,
): Promise<ResolvedMapping | null> {
  const key = cacheKey(eventName, providerKind);
  const now = Date.now();
  const cached = resolveCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  let resolved: ResolvedMapping | null = null;
  try {
    const active = await getActiveMemoized();
    if (active) {
      const cell = active.mappings[eventName]?.[providerKind] as MappingCell | undefined;
      if (cell && cell.isEnabled && cell.mappedName) {
        resolved = {
          mappedName: cell.mappedName,
          isCustom: cell.isCustom,
          notes: cell.notes,
        };
      } else if (!cell) {
        // Event présent dans le catalog code mais absent de la version active
        // → fallback au code pour ne pas perdre le dispatch.
        const fallback = mapEventName(eventName, providerKind);
        if (fallback) {
          resolved = { mappedName: fallback, isCustom: false, notes: null };
        }
      }
      // Si cell existe avec isEnabled=false ou mappedName=null → resolved reste null (intent admin)
    } else {
      // Pas de version active → fallback au code legacy
      const fallback = mapEventName(eventName, providerKind);
      if (fallback) {
        resolved = { mappedName: fallback, isCustom: false, notes: null };
      }
    }
  } catch {
    // En cas d'erreur DB, fallback au code (résilience)
    const fallback = mapEventName(eventName, providerKind);
    if (fallback) {
      resolved = { mappedName: fallback, isCustom: false, notes: null };
    }
  }

  resolveCache.set(key, { value: resolved, expiresAt: now + RESOLVE_TTL_MS });
  return resolved;
}

/** Invalidate tout le cache (appelé sur activate). */
export function invalidateMappingResolverCache(): void {
  resolveCache.clear();
  invalidateActiveCache();
}
