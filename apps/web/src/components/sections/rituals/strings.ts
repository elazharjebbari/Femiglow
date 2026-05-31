/**
 * Phase 7 wiring — résolution des libellés STRUCTURELS localisés du module
 * « voix de la maison » (/kit) depuis le namespace `marketing.kit.rituals`.
 *
 * Ne concerne QUE les libellés d'interface (kicker, headline, badge, chips de
 * tags, etc.). Les témoignages eux-mêmes (`body`, auteur) viennent du seed /
 * de la DB et restent hors scope i18n.
 *
 * Partagé entre `<RitualsModuleBound>` (RSC) et la résolution serveur du
 * `<RitualsWallDrawer>` (props injectées depuis le layout localisé).
 */
import { RITUAL_TAG_CATALOG } from '@/lib/schemas/rituals';

import type { RitualCardStrings } from './RitualCard';
import type { RitualsModuleStrings } from './RitualsModule';

/**
 * Fonction de traduction scoped sur `marketing.kit.rituals`. Typage libre
 * (clé string) car next-intl interdit les clés dynamiques (`tag_labels.${slug}`)
 * en strict ; le runtime les résout sans souci.
 */
export type RitualsTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Construit la map slug → libellé localisé pour les tags du catalogue. */
function resolveTagLabels(t: RitualsTranslate): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const slug of RITUAL_TAG_CATALOG) {
    labels[slug] = t(`tag_labels.${slug}`);
  }
  return labels;
}

/** Résout les libellés de carte depuis le namespace `marketing.kit.rituals`. */
export function resolveRitualCardStrings(
  t: RitualsTranslate,
): RitualCardStrings {
  return {
    anonymous: t('card_anonymous'),
    // `{date}` est un placeholder de gabarit substitué plus tard par le
    // composant (RitualCard). On le préserve littéralement ici, sinon next-intl
    // jette FORMATTING_ERROR (variable `date` non fournie).
    initiatedSince: t('card_initiated_since', { date: '{date}' }),
    recommendBadge: t('card_recommend_badge'),
    tagLabels: resolveTagLabels(t),
  };
}

/** Résout les libellés du module depuis le namespace `marketing.kit.rituals`. */
export function resolveRitualsModuleStrings(
  t: RitualsTranslate,
): RitualsModuleStrings {
  return {
    kicker: t('kicker'),
    emptyTitle: t('empty_title'),
    emptySubtitle: t('empty_subtitle'),
    headlineSingular: t('headline_singular'),
    headlinePlural: t('headline_plural', { total: '{total}', oui: '{oui}' }),
    readLink: t('read_link', { total: '{total}' }),
    card: resolveRitualCardStrings(t),
  };
}

/** Libellés STRUCTURELS du drawer « rituels partagés » (client component). */
export interface RitualsWallStrings {
  /** Kicker drawer (« RITUELS PARTAGÉS »). */
  kicker: string;
  /** Titre drawer (« Les voix de la maison. »). */
  title: string;
  /** Gabarit headline N témoignages (placeholders `{total}` / `{oui}`). */
  headlinePlural: string;
  /** Libellés de carte forwardés à `<RitualCard>`. */
  card: RitualCardStrings;
}

/**
 * Défaut FR du drawer — préserve le rendu legacy `(marketing)/kit` (où aucun
 * `strings` n'est injecté) byte-identique au hardcode historique.
 */
export const DEFAULT_RITUALS_WALL_STRINGS: RitualsWallStrings = {
  kicker: 'RITUELS PARTAGÉS',
  title: 'Les voix de la maison.',
  headlinePlural: '{total} initiées ont partagé. {oui} reprendraient le rituel.',
  card: {
    anonymous: 'Une initiée',
    initiatedSince: 'Initiée depuis {date}',
    recommendBadge: 'Reviendrait',
    tagLabels: {},
  },
};

/** Résout les libellés du drawer depuis le namespace `marketing.kit.rituals`. */
export function resolveRitualsWallStrings(
  t: RitualsTranslate,
): RitualsWallStrings {
  return {
    kicker: t('wall_kicker'),
    title: t('wall_title'),
    headlinePlural: t('headline_plural', { total: '{total}', oui: '{oui}' }),
    card: resolveRitualCardStrings(t),
  };
}
