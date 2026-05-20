/**
 * `ResponsiveIngredientList` — wrapper qui choisit la représentation des
 * ingrédients selon le breakpoint Tailwind :
 *  - `< sm` (640 px) : liste de cards verticales `IngredientCard`
 *  - `≥ sm`        : tableau 5 colonnes `IngredientsTable`
 *
 * Le tri par `%` décroissant est appliqué par chaque sous-composant en
 * interne — pas besoin de le pré-trier ici (mais on garde l'option pour
 * éviter le double-tri par défense).
 *
 * Server Component — aucune logique stateful.
 */
import { IngredientCard } from './IngredientCard';
import { IngredientsTable } from './IngredientsTable';
import { sortByConcentrationDesc } from '@/lib/kit/composition/sort';
import type {
  IngredientDetailed,
  SubProductAccentColor,
} from '@/lib/schemas';

export interface ResponsiveIngredientListProps {
  ingredients: ReadonlyArray<IngredientDetailed>;
  subProductId: string;
  accentColor?: SubProductAccentColor;
}

export function ResponsiveIngredientList({
  ingredients,
  subProductId,
  accentColor,
}: ResponsiveIngredientListProps): JSX.Element {
  const sorted = sortByConcentrationDesc(ingredients);
  return (
    <>
      {/* Mobile : cards verticales — Kolenda §4.5 + UX §1 ≤ 4 colonnes */}
      <ul
        className="space-y-3 sm:hidden"
        aria-label={`Composition de ${subProductId}, par ordre décroissant`}
        data-testid={`responsive-list-mobile-${subProductId}`}
      >
        {sorted.map((ing) => (
          <li key={ing.inci}>
            <IngredientCard
              ingredient={ing}
              subProductId={subProductId}
              accentColor={accentColor}
            />
          </li>
        ))}
      </ul>

      {/* Desktop : tableau 5 colonnes */}
      <div
        className="hidden sm:block"
        data-testid={`responsive-list-desktop-${subProductId}`}
      >
        <IngredientsTable
          ingredients={sorted}
          subProductId={subProductId}
          accentColor={accentColor}
        />
      </div>
    </>
  );
}
