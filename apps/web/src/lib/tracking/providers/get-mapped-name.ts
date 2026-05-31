/**
 * Helper centralisé pour récupérer le nom vendor d'un event.
 *
 * Contrat :
 *  - Si `ctx.resolvedMappings` est défini (cas dispatcher V1.1+) → on lit
 *    UNIQUEMENT cette source. Si la clé provider est absente ou `mappedName`
 *    null, on retourne null → adapter doit skip.
 *  - Si `ctx.resolvedMappings` est `undefined` (cas dispatch direct hors du
 *    dispatcher principal, ex: tests legacy, builders GTM, scripts) → on
 *    fallback sur `mapEventName(ctx.eventName, kind)` du code legacy.
 *
 * Cette stratégie garantit :
 *  - L'admin qui désactive un mapping via UI (isEnabled=false) est respecté
 *    dans le dispatcher prod (la cellule est absente de resolvedMappings)
 *  - Les call-sites legacy continuent de fonctionner sans modification
 *  - Pas de double source de vérité quand resolvedMappings est présent
 *
 * cf. docs/event-mappings/30-backend/service-layer.md (refactor dispatcher V1.1)
 */
import type { TrackingProviderKind } from '@/lib/db/types';
import { mapEventName } from './event-mapping';
import type { DispatchContext } from './types';

export function getMappedName(
  ctx: DispatchContext,
  kind: TrackingProviderKind,
): string | null {
  if (ctx.resolvedMappings !== undefined) {
    // Path V1.1+ : source de vérité = resolvedMappings injecté par le dispatcher.
    return ctx.resolvedMappings[kind]?.mappedName ?? null;
  }
  // Legacy fallback (tests, scripts, dispatchers historiques).
  return mapEventName(ctx.eventName, kind);
}

/**
 * Indique si l'event Meta doit être envoyé via `trackCustom` (custom event).
 * Pour les autres providers, retourne toujours false (concept Meta-only).
 */
export function isMetaCustomEvent(ctx: DispatchContext): boolean {
  if (ctx.resolvedMappings !== undefined) {
    return ctx.resolvedMappings.meta?.isCustom ?? false;
  }
  // Pas d'info isCustom côté code legacy → false par défaut.
  // Le legacy event-mapping.ts n'a pas cette notion ; un event Meta avec un
  // nom non-standard sera envoyé comme standard (peut produire un warning
  // côté Meta API mais ne fail pas).
  return false;
}
