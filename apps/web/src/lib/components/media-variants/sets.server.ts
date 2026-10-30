/**
 * Médias par audience — lecture des ensembles d'un composant (serveur).
 *
 *  - `getPublishedMediaSets(key)` : UNE requête, projetée en DTO compact
 *    (`dto.ts`) puis mise en cache
 *    (`unstable_cache`, tags `components` et `components:media-sets:<key>`,
 *    30 min). Une seule entrée de cache par composant : la variante est
 *    choisie ensuite en mémoire (`selectMediaSet`), sur le modèle de
 *    `resolveKitHeroAngleCopy` — pas de fragmentation par angle ni langue.
 *  - `getDraftMediaSets(key)` : aperçu admin (brouillon > publié), sans cache.
 *
 * Renvoie `null` si le composant est inconnu ou sans politique `mediaVariants`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  listPreviewSetsWithMedia,
  listPublishedSetsWithMedia,
} from '@/lib/db/queries/component-media-sets';
import { toMediaSetDTOs } from './dto';
import { readMediaVariantPolicy } from './policy';
import type { ComponentMediaSetsSnapshot } from './types';

/** Durée de vie du cache (s), alignée sur `resolveComponentSlot`. */
export const MEDIA_SETS_REVALIDATE_SECONDS = 60 * 30;

/** Tag d'invalidation propre aux ensembles d'un composant. */
export function mediaSetsCacheTag(componentKey: string): string {
  return `components:media-sets:${componentKey}`;
}

async function loadSnapshot(
  componentKey: string,
  mode: 'published' | 'preview',
): Promise<ComponentMediaSetsSnapshot | null> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return null;
  const policy = readMediaVariantPolicy(component.metadata);
  if (!policy) return null;
  const rows =
    mode === 'published'
      ? await listPublishedSetsWithMedia(component.id)
      : await listPreviewSetsWithMedia(component.id);
  // Projection AVANT la mise en cache : JSON pur, sans lignes `media` ni
  // variants (limite 2 Mo de `unstable_cache`, dates sérialisées).
  return { componentId: component.id, componentKey, policy, sets: toMediaSetDTOs(rows) };
}

/** Ensembles publiés d'un composant (cachés). */
export async function getPublishedMediaSets(
  componentKey: string,
): Promise<ComponentMediaSetsSnapshot | null> {
  const cached = unstable_cache(
    async (key: string) => loadSnapshot(key, 'published'),
    ['component-media-sets', componentKey],
    {
      revalidate: MEDIA_SETS_REVALIDATE_SECONDS,
      tags: ['components', mediaSetsCacheTag(componentKey)],
    },
  );
  return cached(componentKey);
}

/** Aperçu admin : brouillon s'il existe, sinon publié (jamais caché). */
export async function getDraftMediaSets(
  componentKey: string,
): Promise<ComponentMediaSetsSnapshot | null> {
  return loadSnapshot(componentKey, 'preview');
}
