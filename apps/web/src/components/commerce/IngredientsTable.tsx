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
export type IngredientsTableProps =
  | { subProduct: SubProduct; ingredients?: never; subProductId?: never; accentColor?: never }
  | {
      ingredients: ReadonlyArray<IngredientDetailed>;
      subProductId: string;
      accentColor?: SubProductAccentColor;
      subProduct?: never;
    };

export function IngredientsTable(props: IngredientsTableProps): JSX.Element {
  const ingredients = props.subProduct ? props.subProduct.ingredients : props.ingredients;
  const subProductId = props.subProduct ? props.subProduct.id : props.subProductId;
  const accentColor = props.subProduct ? props.subProduct.accentColor : props.accentColor;
  const accent = resolveAccentHex(accentColor);
  const sorted = sortByConcentrationDesc(ingredients);

  return (
    <div
      role="region"
      aria-label={`Composition de ${subProductId}`}
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
    >
      <table
        className="w-full border-collapse text-sm"
        data-testid={`ingredients-table-${subProductId}`}
      >
        <thead className="bg-sauge-soft text-left text-[11px] uppercase tracking-[0.12em] text-encre/70">
          <tr>
            <th scope="col" className="p-3 font-medium">Ingrédient</th>
            <th scope="col" className="p-3 font-medium">INCI</th>
            <th scope="col" className="p-3 font-medium">Fonction</th>
            <th scope="col" className="p-3 font-medium">Origine</th>
            <th scope="col" className="p-3 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody className="text-encre">
          {sorted.map((ing, i) => (
            <tr
              key={`${subProductId}-${ing.inci}`}
              className={i % 2 === 0 ? 'bg-creme' : 'bg-creme-warm/40'}
            >
              <th scope="row" className="p-3 text-left font-medium">
                {ing.name}
              </th>
              <td className="p-3 text-encre/70">{ing.inci}</td>
              <td className="p-3">{ing.function}</td>
              <td className="p-3">{ing.origin}</td>
              <td
                className="p-3 text-right [font-feature-settings:'tnum','lnum']"
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
