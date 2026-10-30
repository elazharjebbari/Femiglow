/**
 * Médias par audience — invalidation du cache public.
 *
 * Les ensembles publiés sont lus via `unstable_cache` (tags `components` et
 * `components:media-sets:<key>`, 30 min — cf. `sets.server.ts`). Toute
 * mutation qui change ce qui est SERVI (publication, dépublication,
 * promotion programmée, publication en masse, média modifié ou supprimé)
 * doit invalider ces tags ; un brouillon, invisible du public, non.
 *
 * L'invalidation est « best effort » : la mutation est déjà validée en
 * base quand on invalide, une erreur ici (hors contexte Next, par exemple
 * un script) est journalisée sans transformer un succès en 500. Au pire,
 * le cache expire seul au bout de 30 minutes.
 */
import 'server-only';
import { revalidateTag } from 'next/cache';
import { logger } from '@/lib/logging/logger';
import { listMediaSetUsages } from '@/lib/db/queries/component-media-sets';
import { mediaSetsCacheTag } from './sets.server';

/** Tag global des composants (bindings, champs, ensembles). */
export const COMPONENTS_CACHE_TAG = 'components';

/** Invalide une liste de tags sans jamais lever. Renvoie les tags invalidés. */
export function revalidateTagsSafely(tags: readonly string[], context: string): string[] {
  const done: string[] = [];
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag);
      done.push(tag);
    } catch (err) {
      logger.warn('cache.revalidate_failed', {
        tag,
        context,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return done;
}

/**
 * Invalide le cache des ensembles publiés des composants donnés (+ le tag
 * global `components`, qui couvre aussi un composant dont la clé n'a pas pu
 * être lue). Liste vide → rien n'est invalidé ; clés `null`/vides → seul
 * `components` l'est.
 */
export function revalidateMediaSets(
  componentKeys: Iterable<string | null | undefined>,
  context: string,
): string[] {
  const all = Array.from(componentKeys);
  if (all.length === 0) return [];
  const keys = all.filter((k): k is string => !!k);
  return revalidateTagsSafely([COMPONENTS_CACHE_TAG, ...keys.map(mediaSetsCacheTag)], context);
}

/**
 * Après une modification de médias (alt, statut, suppression, variants
 * régénérés) : invalide `components` (liaisons historiques et ensembles)
 * ET, de façon ciblée, `components:media-sets:<key>` de chaque composant
 * dont un ensemble référence l'un de ces médias. La recherche d'usages ne
 * fait jamais échouer l'appelant : en cas d'erreur, seul `components` est
 * invalidé (il couvre déjà tous les ensembles).
 */
export async function revalidateForMediaChange(
  mediaIds: Iterable<string>,
  context: string,
): Promise<string[]> {
  const ids = Array.from(new Set(mediaIds)).filter(Boolean);
  if (ids.length === 0) return [];
  const keys = new Set<string>();
  for (const id of ids) {
    try {
      for (const usage of await listMediaSetUsages(id)) {
        if (usage.componentKey) keys.add(usage.componentKey);
      }
    } catch (err) {
      logger.warn('cache.media_usage_lookup_failed', {
        media_id: id,
        context,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return revalidateTagsSafely(
    [COMPONENTS_CACHE_TAG, ...Array.from(keys, mediaSetsCacheTag)],
    context,
  );
}
