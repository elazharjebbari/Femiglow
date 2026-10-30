/**
 * Médias par audience — résolution des slots d'un composant (serveur).
 *
 * `resolveComponentMediaSlots(key, ctx)` lit les ensembles (une requête
 * cachée par composant), applique `selectMediaSet` slot par slot (niveaux
 * 1 à 6) et renvoie les images prêtes à afficher + une trace par slot.
 * Un slot sans ensemble renvoie `null` avec une trace de niveau 7 : c'est à
 * l'appelant d'appliquer les liaisons legacy (7) puis le produit (8), et de
 * corriger la trace via `delegatedTrace(slot, 8)` si besoin.
 *
 * Rien n'est encore branché sur les pages (PR 4).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4
 */
import 'server-only';
import type { MediaVariantPolicy } from '@/lib/components/registry';
import { toResolvedImages } from './images';
import { selectMediaSet } from './select';
import { getDraftMediaSets, getPublishedMediaSets } from './sets.server';
import { delegatedTrace } from './tracking';
import type { AudienceContext, MediaSetDTO, MediaSlotTrace, ResolvedMediaImage } from './types';

export { toResolvedImages, resolveItemAlt } from './images';
export { mediaVariantTrackingValue, traceTrackingValue, delegatedTrace } from './tracking';

export interface ResolveComponentMediaSlotsOptions {
  /** Aperçu admin : brouillons prioritaires, sans cache. */
  draft?: boolean;
  /** Alt de dernier recours, déjà localisé (ex. nom du produit). */
  fallbackAlt?: string;
}

export interface ResolvedComponentMediaSlots {
  /** Images par slot de la politique ; `null` = repli délégué (niveaux 7–8). */
  slots: Record<string, ResolvedMediaImage[] | null>;
  traces: Record<string, MediaSlotTrace>;
}

/**
 * Cœur pur de la résolution (testable sans cache ni base) : applique la
 * sélection à chaque slot de la politique.
 */
export function resolveMediaSlotsFromSets(
  sets: readonly MediaSetDTO[],
  policy: MediaVariantPolicy,
  ctx: AudienceContext,
  fallbackAlt?: string,
): ResolvedComponentMediaSlots {
  const slots: ResolvedComponentMediaSlots['slots'] = {};
  const traces: ResolvedComponentMediaSlots['traces'] = {};
  for (const slotPolicy of policy.slots) {
    const selection = selectMediaSet(sets, slotPolicy.key, ctx, policy);
    if (!selection) {
      slots[slotPolicy.key] = null;
      traces[slotPolicy.key] = delegatedTrace(slotPolicy.key, 7);
      continue;
    }
    slots[slotPolicy.key] = toResolvedImages(selection.items, { locale: ctx.locale, fallbackAlt });
    traces[slotPolicy.key] = {
      slot: slotPolicy.key,
      level: selection.level,
      setId: selection.set.id,
      variantDim: selection.set.variantDim,
      variantKey: selection.set.variantKey,
      locale: selection.set.locale,
      version: selection.set.version,
    };
  }
  return { slots, traces };
}

/**
 * Résout tous les slots « médias par audience » d'un composant pour un
 * contexte. Composant inconnu ou sans politique → `{ slots: {}, traces: {} }`
 * (l'appelant garde son comportement historique).
 */
export async function resolveComponentMediaSlots(
  componentKey: string,
  ctx: AudienceContext,
  { draft = false, fallbackAlt }: ResolveComponentMediaSlotsOptions = {},
): Promise<ResolvedComponentMediaSlots> {
  const snapshot = draft
    ? await getDraftMediaSets(componentKey)
    : await getPublishedMediaSets(componentKey);
  if (!snapshot) return { slots: {}, traces: {} };
  return resolveMediaSlotsFromSets(snapshot.sets, snapshot.policy, ctx, fallbackAlt);
}
