/**
 * `resolvePageWithComponents` — résout la metadata SEO d'une page en
 * fusionnant l'override de la page elle-même avec les overrides des
 * composants pilotés par CMS qui la composent.
 *
 * Phase 5 du plan SEO. Branchement explicite : la page appelle ce helper
 * en listant ses composants éligibles. Le helper :
 *  1. Résout la metadata page via `resolveSeoMetadata` (cascade existante).
 *  2. Fetch en batch les overrides composants publiés (une seule requête).
 *  3. Fusionne : pour chaque composant, les champs marqués `overridable`
 *     du composant écrasent ceux de la page **si non vides**.
 *
 * Priorité de fusion (du plus fort au plus faible) :
 *   composant.published > page.published > settings > defaults
 *
 * Garde-fou : si `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES !== 'true'`, le helper
 * retourne strictement la résolution page sans toucher au composant. Cela
 * garantit zéro régression côté snapshot tant que le flag est off.
 *
 * cf. docs/seo-action-plan-2026-05/04-backend-design.md §2.1
 */
import { getActiveComponentOverrides } from '@/lib/db/queries/seo';
import { logger } from '@/lib/logging/logger';

import { resolveSeoMetadata } from './resolve';
import type { ResolvedSeoMetadata, SeoOverride, SeoScope } from './types';

export type OverridableField =
  | 'title'
  | 'description'
  | 'ogTitle'
  | 'ogDescription';

export interface ComponentSeoInput {
  componentKey: string;
  /**
   * Champs que ce composant est autorisé à écraser dans la metadata page.
   * Défaut : `['title', 'description', 'ogTitle', 'ogDescription']`.
   * `og.image` (mediaId/template) n'est jamais écrasé par un composant
   * pour préserver la cohérence visuelle de la page parente.
   */
  overridableFields?: OverridableField[];
}

export interface ResolvePageWithComponentsOptions {
  pageScope: SeoScope;
  pageTargetKey: string;
  components: ComponentSeoInput[];
  locale?: string;
  fallback?: { title?: string; description?: string };
}

export interface PageComponentTrace {
  componentKey: string;
  source: 'override' | 'none';
}

export interface ResolvedPageMetadata extends ResolvedSeoMetadata {
  /**
   * Trace par composant utilisée pour debug et endpoint `_debug/seo`.
   * Indique pour chaque composant si un override a été appliqué.
   */
  componentOverrides: PageComponentTrace[];
}

const DEFAULT_OVERRIDABLE: OverridableField[] = [
  'title',
  'description',
  'ogTitle',
  'ogDescription',
];

/**
 * Indique si la résolution composant est activée pour le runtime courant.
 *
 * Pourquoi un flag explicite plutôt qu'un default-on : la phase 5 modifie
 * le rendu metadata public ; en cas de bug, on veut un kill-switch
 * runtime (env var) sans redéploiement.
 *
 * Lu via `process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` côté server.
 */
export function isComponentScopeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES === 'true';
}

/**
 * Fusionne la metadata page avec les overrides composants.
 *
 * Quand le flag est désactivé, retourne strictement le résultat de
 * `resolveSeoMetadata(page)` enveloppé dans la même forme (avec
 * `componentOverrides: []`). Cela garantit que les snapshots de
 * non-régression sont stables.
 */
export async function resolvePageWithComponents(
  opts: ResolvePageWithComponentsOptions,
): Promise<ResolvedPageMetadata> {
  const locale = opts.locale ?? 'fr-MA';

  // Toujours résoudre la page d'abord — c'est la base de la fusion.
  const pageResolved = await resolveSeoMetadata({
    scope: opts.pageScope,
    targetKey: opts.pageTargetKey,
    locale,
    fallback: opts.fallback,
  });

  // Court-circuit si flag désactivé ou aucun composant à fusionner.
  if (!isComponentScopeEnabled() || opts.components.length === 0) {
    return { ...pageResolved, componentOverrides: [] };
  }

  // Batch fetch des composants — une seule requête DB.
  let overrides: Map<string, SeoOverride>;
  try {
    overrides = await getActiveComponentOverrides(
      opts.components.map((c) => c.componentKey),
      locale,
    );
  } catch (err) {
    // En cas d'erreur DB, retomber proprement sur la page (no-op).
    logger.warn('seo.component_resolve_failed', {
      pageScope: opts.pageScope,
      pageTargetKey: opts.pageTargetKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ...pageResolved, componentOverrides: [] };
  }

  let merged: ResolvedSeoMetadata = pageResolved;
  const trace: PageComponentTrace[] = [];

  for (const component of opts.components) {
    const override = overrides.get(component.componentKey);
    if (!override) {
      trace.push({ componentKey: component.componentKey, source: 'none' });
      continue;
    }
    trace.push({ componentKey: component.componentKey, source: 'override' });
    merged = applyComponentOverride(
      merged,
      override,
      component.overridableFields ?? DEFAULT_OVERRIDABLE,
    );
  }

  // Si au moins un composant a appliqué un override, on marque la source
  // pour aider au debugging (le champ `source` cascade existant garde sa
  // sémantique « page-level »).
  const componentApplied = trace.some((t) => t.source === 'override');
  return {
    ...merged,
    componentOverrides: trace,
    source: componentApplied ? 'override' : merged.source,
  };
}

/**
 * Applique les champs d'un override composant à la metadata résolue de la
 * page. N'écrase que les champs marqués `overridable` ET non vides côté
 * composant — un override avec `title: null` ne « gomme » pas le titre
 * page (sinon basculer la cascade composant = perte de signal).
 */
function applyComponentOverride(
  base: ResolvedSeoMetadata,
  override: SeoOverride,
  overridable: OverridableField[],
): ResolvedSeoMetadata {
  const next: ResolvedSeoMetadata = {
    ...base,
    og: { ...base.og },
    robots: { ...base.robots },
    twitter: { ...base.twitter },
  };

  if (overridable.includes('title') && override.title) {
    next.title = override.title;
  }
  if (overridable.includes('description') && override.description) {
    next.description = override.description;
  }
  if (overridable.includes('ogTitle') && override.ogTitle) {
    next.og.title = override.ogTitle;
  } else if (overridable.includes('ogTitle') && override.title) {
    // Si pas de ogTitle dédié mais un title composant, il propage à og.title
    // par cohérence avec la cascade page (où og.title fallback sur title).
    next.og.title = override.title;
  }
  if (overridable.includes('ogDescription') && override.ogDescription) {
    next.og.description = override.ogDescription;
  } else if (overridable.includes('ogDescription') && override.description) {
    next.og.description = override.description;
  }
  return next;
}
