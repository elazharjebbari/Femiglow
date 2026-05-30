import { InciTooltip } from './InciTooltip';
import { resolveAccentHex } from '@/lib/composition/copy';
import { sortByConcentrationDesc } from '@/lib/kit/composition/sort';
import type {
  IngredientDetailed,
  SubProduct,
  SubProductAccentColor,
} from '@/lib/schemas';

/**
 * `IngredientsTable` — tableau 5 colonnes (Ingrédient · INCI · Fonction ·
 * Origine · %) affiché sur desktop (sm+) ou en fallback. Lignes alternées
 * `bg-creme` / `bg-creme-warm/40` (Kolenda §4.5 lecture longue).
 *
 * Le tri par `%` décroissant est appliqué (Kolenda §11 Luxury transparence).
 *
 * Deux formes de propriétés acceptées :
 *  - `subProduct` (legacy) : passé tel quel, on en extrait ingredients +
 *    id + accentColor. Rétrocompat strict — l'ancien code reste valide.
 *  - `ingredients` + `subProductId` + `accentColor` (nouveau) : permet
 *    une utilisation découplée dans `ResponsiveIngredientList`.
 */
/**
 * Phase 9 i18n — libellés de colonnes localisés + rendu de l'INCI entre
 * parenthèses sur /ar (l'audit strict tolère le latin entre parenthèses,
 * cf. décision INCI). FR/EN : labels par défaut, INCI nu (inchangé).
 */
export interface IngredientsTableLabels {
  ingredient: string;
  inci: string;
  function: string;
  origin: string;
  regionAria: string;
  /** Quand `true`, l'INCI latin s'affiche entre parenthèses (AR). */
  inciInParens?: boolean;
}

const DEFAULT_LABELS: IngredientsTableLabels = {
  ingredient: 'Ingrédient',
  inci: 'INCI',
  function: 'Fonction',
  origin: 'Origine',
  regionAria: 'Composition',
};

export type IngredientsTableProps = (
  | { subProduct: SubProduct; ingredients?: never; subProductId?: never; accentColor?: never }
  | {
      ingredients: ReadonlyArray<IngredientDetailed>;
      subProductId: string;
      accentColor?: SubProductAccentColor;
      subProduct?: never;
    }
) & { labels?: IngredientsTableLabels };

export function IngredientsTable(props: IngredientsTableProps): JSX.Element {
  const ingredients = props.subProduct ? props.subProduct.ingredients : props.ingredients;
  const subProductId = props.subProduct ? props.subProduct.id : props.subProductId;
  const accentColor = props.subProduct ? props.subProduct.accentColor : props.accentColor;
  const labels = props.labels ?? DEFAULT_LABELS;
  const renderInci = (inci: string) =>
    labels.inciInParens ? `(${inci})` : inci;
  const accent = resolveAccentHex(accentColor);
  const sorted = sortByConcentrationDesc(ingredients);

  return (
    <div
      role="region"
      aria-label={`${labels.regionAria} ${subProductId}`}
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
    >
      <table
        className="w-full border-collapse text-sm"
        data-testid={`ingredients-table-${subProductId}`}
      >
        <thead className="bg-sauge-soft text-start text-[11px] uppercase tracking-[0.12em] text-encre/70">
          <tr>
            <th scope="col" className="p-3 font-medium">{labels.ingredient}</th>
            <th scope="col" className="p-3 font-medium">{labels.inci}</th>
            <th scope="col" className="p-3 font-medium">{labels.function}</th>
            <th scope="col" className="p-3 font-medium">{labels.origin}</th>
            <th scope="col" className="p-3 text-end font-medium">%</th>
          </tr>
        </thead>
        <tbody className="text-encre">
          {sorted.map((ing, i) => (
            <tr
              key={`${subProductId}-${ing.inci}`}
              className={i % 2 === 0 ? 'bg-creme' : 'bg-creme-warm/40'}
            >
              <th scope="row" className="p-3 text-start font-medium">
                {ing.name}
              </th>
              <td className="p-3 text-encre/70">
                {renderInci(ing.inci)}
                {ing.inciDefinition ? (
                  <InciTooltip
                    inciTerm={ing.inci}
                    definition={ing.inciDefinition}
                    subProductId={subProductId}
                  />
                ) : null}
              </td>
              <td className="p-3">{ing.function}</td>
              <td className="p-3">{ing.origin}</td>
              <td
                className="p-3 text-end [font-feature-settings:'tnum','lnum']"
                style={ing.concentrationPct !== undefined ? { color: accent } : undefined}
              >
                {ing.concentrationPct !== undefined ? `${ing.concentrationPct} %` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
