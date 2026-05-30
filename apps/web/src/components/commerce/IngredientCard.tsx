/**
 * `IngredientCard` — carte verticale rendue sur mobile (< sm) à la place
 * du tableau, pour éviter le scroll horizontal forcé sur les 5 colonnes
 * INCI.
 *
 * Hiérarchie visuelle Kolenda §4.5 :
 *  - Nom (gros, encre) + `%` (accent color, tabular-nums)
 *  - INCI (petit, gris encre/55)
 *  - Fonction · Origine (corps, encre/75)
 *
 * Le bouton ⓘ à côté du nom INCI ouvre `InciTooltip` (Phase 3) si
 * l'ingredient porte une `inciDefinition` (Phase 1).
 */
import { InciTooltip } from './InciTooltip';
import { resolveAccentHex } from '@/lib/composition/copy';
import type { IngredientDetailed, SubProductAccentColor } from '@/lib/schemas';

export interface IngredientCardProps {
  ingredient: IngredientDetailed;
  subProductId: string;
  accentColor?: SubProductAccentColor;
  /**
   * Phase 9 i18n — affiche l'INCI latin entre parenthèses (AR), toléré par
   * l'audit strict. FR/EN : INCI nu (défaut, inchangé).
   */
  inciInParens?: boolean;
}

export function IngredientCard({
  ingredient,
  subProductId,
  accentColor,
  inciInParens = false,
}: IngredientCardProps): JSX.Element {
  const accent = resolveAccentHex(accentColor);
  const pct = ingredient.concentrationPct;
  const inciLabel = inciInParens ? `(${ingredient.inci})` : ingredient.inci;

  return (
    <div
      className="rounded-md border border-encre/10 bg-creme p-4"
      data-testid={`ingredient-card-${subProductId}-${ingredient.inci}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base text-encre flex-1">
          {ingredient.name}
        </p>
        {pct !== undefined ? (
          <p
            className="font-display text-base font-medium [font-feature-settings:'tnum','lnum']"
            style={{ color: accent }}
          >
            {pct}&#x202f;%
          </p>
        ) : (
          <p className="text-base text-encre/40">—</p>
        )}
      </div>
      <p className="mt-1 text-xs text-encre/55 font-body">
        {inciLabel}
        {ingredient.inciDefinition ? (
          <InciTooltip
            inciTerm={ingredient.inci}
            definition={ingredient.inciDefinition}
            subProductId={subProductId}
          />
        ) : null}
      </p>
      <p className="mt-2 text-sm text-encre/75 font-body">
        {ingredient.function}
        <span className="mx-2 text-encre/30" aria-hidden="true">
          ·
        </span>
        {ingredient.origin}
      </p>
    </div>
  );
}
