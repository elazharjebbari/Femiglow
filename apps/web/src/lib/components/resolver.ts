/**
 * Component-Media resolver.
 *
 * Récupère, pour un (componentKey, slot) donné :
 *  - le binding actif (si présent),
 *  - le Media associé + ses variants,
 *  - et l'animation par défaut + le SVG fallback,
 * le tout cached via `unstable_cache` (tag `components`) — invalidé via
 * `revalidateTag('components')` après toute mutation admin.
 *
 * Si pas de binding actif → renvoie le SVG fallback path. Le composant
 * `<ComponentMedia>` côté client/RSC sait afficher l'un ou l'autre.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import {
  getActiveBindingWithMedia,
} from '@/lib/db/queries/component-bindings';
import {
  getDefaultAnimationForComponent,
  listAnimationBindingsWithAnimation,
} from '@/lib/db/queries/component-animations';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { getMediaWithRelations } from '@/lib/db/queries/media';
import type {
  ComponentAnimation,
  ComponentMediaBinding,
  MediaWithRelations,
  SiteComponent,
  SlotDefinition,
} from '@/lib/db/types';

export interface ResolvedComponentSlot {
  component: SiteComponent;
  slot: SlotDefinition | null;
  binding: ComponentMediaBinding | null;
  media: MediaWithRelations | null;
  animation: ComponentAnimation | null;
  /** SVG path à afficher si pas de média actif (fallback). */
  fallbackSvg: string | null;
  /** loading strategy effective (binding > component default). */
  loadingStrategy: 'eager' | 'viewport' | 'idle' | 'interaction';
  /** fetch priority effective. */
  fetchPriority: 'high' | 'low' | 'auto';
  /** alt effectif (binding.customAlt > media.alt > slot.label). */
  alt: string;
}

async function fetchResolvedSlot(
  componentKey: string,
  slot: string,
): Promise<ResolvedComponentSlot | null> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return null;
  const slotDef = component.slots.find((s) => s.key === slot) ?? null;

  const active = await getActiveBindingWithMedia(component.id, slot);
  const binding = active?.binding ?? null;
  const media = active?.media
    ? await getMediaWithRelations(active.media.id)
    : null;
  const animation = await getDefaultAnimationForComponent(component.id);

  const fallbackSvg = component.defaultSvgFallback;
  const loadingStrategy =
    binding?.loadingStrategy ?? component.defaultLoadingStrategy;
  const fetchPriority = binding?.fetchPriority ?? component.defaultFetchPriority;
  const alt =
    binding?.customAlt ??
    media?.alt ??
    slotDef?.label ??
    component.name;

  return {
    component,
    slot: slotDef,
    binding,
    media,
    animation,
    fallbackSvg,
    loadingStrategy,
    fetchPriority,
    alt,
  };
}

const cachedFetch = unstable_cache(
  async (componentKey: string, slot: string) => fetchResolvedSlot(componentKey, slot),
  ['component-media-slot'],
  { revalidate: 60 * 30, tags: ['components'] },
);

/**
 * Résout un slot d'un composant côté serveur (RSC ou route handler).
 *
 * @example
 *   const r = await resolveComponentSlot('home-hero', 'primary');
 *   if (r?.media) renderImage(r.media);
 *   else renderSvg(r?.fallbackSvg);
 */
export async function resolveComponentSlot(
  componentKey: string,
  slot: string,
): Promise<ResolvedComponentSlot | null> {
  return cachedFetch(componentKey, slot);
}

/**
 * Résout tous les slots d'un composant (utilisé par les sections type
 * AvisStrip, CrossLinkTriptyque qui ont plusieurs slots).
 */
export async function resolveComponentSlots(
  componentKey: string,
): Promise<ResolvedComponentSlot[]> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return [];
  const out: ResolvedComponentSlot[] = [];
  for (const slot of component.slots) {
    const r = await resolveComponentSlot(componentKey, slot.key);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Récupère les profils d'animation rattachés à un composant (admin).
 */
export async function listComponentAnimations(componentKey: string) {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return [];
  return listAnimationBindingsWithAnimation(component.id);
}
