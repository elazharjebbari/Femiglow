/**
 * Médias par audience — couverture d'une politique (module PUR).
 *
 * Pour chaque valeur de dimension déclarée (plus la ligne `default`) ×
 * chaque langue du site × chaque slot, calcule quel ensemble serait servi
 * et à quel niveau de la chaîne de repli (§4.3). Le calcul RÉUTILISE
 * `selectMediaSet` : la matrice admin affiche exactement ce que verra la
 * visiteuse, sans réimplémenter la chaîne.
 *
 * Les dimensions dont les valeurs ne sont pas connues statiquement
 * (`ab:<expKey>`) sont listées dans `skippedDimensions`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import { LOCALES, type Locale } from '@/i18n.config';
import type { MediaVariantPolicy } from '@/lib/components/registry';
import { DEFAULT_DIMENSION, WILDCARD, getDimension } from './dimensions';
import { selectMediaSet } from './select';
import type { FallbackLevel, MediaSetDTO } from './types';

/** Une cellule de la matrice : (dimension, valeur, langue, slot). */
export interface MediaSetCoverageCell {
  slot: string;
  /** Ligne : `default` ou une dimension de la politique. */
  variantDim: string;
  /** `*` pour la ligne `default`. */
  variantKey: string;
  locale: Locale;
  /** 1–6 = un ensemble ; 7 = repli délégué (liaisons legacy, puis produit). */
  level: FallbackLevel;
  /**
   * Vrai si l'ensemble servi appartient à la LIGNE (même dimension et même
   * clé : niveaux 1–3 pour une valeur d'angle, 4–6 pour `default`), quelle
   * que soit sa langue. Faux = la ligne hérite d'une autre dimension ou du
   * défaut (« hérite de… »).
   */
  exact: boolean;
  /** Vrai si l'ensemble servi est celui de la langue exacte (niveau 1 ou 4). */
  sameLocale: boolean;
  /** Ensemble servi (niveaux 1–6), sinon `null`. */
  setId: string | null;
  /** Tuple de l'ensemble servi — « hérite de… » quand `exact` est faux. */
  source: {
    variantDim: string;
    variantKey: string;
    locale: string;
    version: number;
    crossLocale: boolean;
  } | null;
  /** Nombre d'images affichables servies (plafonné par le slot). */
  itemCount: number;
}

export interface MediaSetCoverageSummary {
  total: number;
  /** Cellules servies par un ensemble de leur propre ligne (dimension + clé). */
  exact: number;
  /** Cellules servies par une autre dimension ou par le défaut. */
  inherited: number;
  /** Cellules sans ensemble : liaisons legacy / image produit. */
  delegated: number;
}

export interface MediaSetCoverage {
  cells: MediaSetCoverageCell[];
  summary: MediaSetCoverageSummary;
  /** Dimensions aux valeurs dynamiques, non énumérables ici (A/B). */
  skippedDimensions: string[];
}

interface Row {
  variantDim: string;
  variantKey: string;
}

/** Lignes de la matrice : `default` puis chaque valeur des dimensions statiques. */
function coverageRows(policy: MediaVariantPolicy): { rows: Row[]; skipped: string[] } {
  const rows: Row[] = [{ variantDim: DEFAULT_DIMENSION, variantKey: WILDCARD }];
  const skipped: string[] = [];
  for (const dim of policy.dimensions) {
    if (dim === DEFAULT_DIMENSION) continue;
    const values = getDimension(dim)?.values ?? null;
    if (!values) {
      skipped.push(dim);
      continue;
    }
    for (const value of values) rows.push({ variantDim: dim, variantKey: value });
  }
  return { rows, skipped };
}

/**
 * Calcule la couverture d'une politique pour un jeu d'ensembles (publiés en
 * général ; un aperçu brouillon fonctionne aussi). `locales` : langues de
 * la visiteuse à simuler (défaut : toutes les langues du site).
 */
export function computeMediaSetCoverage(
  sets: readonly MediaSetDTO[],
  policy: MediaVariantPolicy,
  locales: readonly Locale[] = LOCALES,
): MediaSetCoverage {
  const { rows, skipped } = coverageRows(policy);
  const cells: MediaSetCoverageCell[] = [];
  for (const row of rows) {
    // Une seule dimension renseignée par ligne : la cellule mesure ce que
    // cette valeur obtient seule (la ligne `default` = aucune dimension).
    const variants: Record<string, string> =
      row.variantDim === DEFAULT_DIMENSION ? {} : { [row.variantDim]: row.variantKey };
    for (const locale of locales) {
      for (const slot of policy.slots) {
        const selection = selectMediaSet(sets, slot.key, { locale, variants }, policy);
        const ownRow =
          !!selection &&
          selection.set.variantDim === row.variantDim &&
          selection.set.variantKey === row.variantKey;
        cells.push({
          slot: slot.key,
          variantDim: row.variantDim,
          variantKey: row.variantKey,
          locale,
          level: selection ? selection.level : 7,
          exact: ownRow,
          sameLocale: ownRow && selection!.set.locale === locale,
          setId: selection?.set.id ?? null,
          source: selection
            ? {
                variantDim: selection.set.variantDim,
                variantKey: selection.set.variantKey,
                locale: selection.set.locale,
                version: selection.set.version,
                crossLocale: selection.set.crossLocale,
              }
            : null,
          itemCount: selection?.items.length ?? 0,
        });
      }
    }
  }
  const exact = cells.filter((c) => c.exact).length;
  const delegated = cells.filter((c) => c.level === 7).length;
  return {
    cells,
    summary: { total: cells.length, exact, inherited: cells.length - exact - delegated, delegated },
    skippedDimensions: skipped,
  };
}
