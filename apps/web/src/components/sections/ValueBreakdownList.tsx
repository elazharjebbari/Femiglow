/**
 * `ValueBreakdownList` — décomposition de la valeur du pack sous le
 * prix XXL (Kolenda §4.6 — Valeur séparée explicite).
 *
 * Affiche une liste verticale d'items `{label, valueLabel, muted?}`.
 * Les items `muted: true` (ex : « offert ») sont rendus en italique +
 * opacity réduite pour les distinguer des items chiffrés.
 *
 * Server Component pur — aucun hook, aucune dépendance navigateur.
 */
import { cn } from '@/lib/utils/cn';
import type { ProductFeedValueItem } from '@/lib/products/feed/types';

export interface ValueBreakdownListProps {
  items: ProductFeedValueItem[];
  /** Label aria (default « Détail de la valeur du pack »). */
  ariaLabel?: string;
  /**
   * Ligne de réduction additionnelle (crédit de fidélité appliqué), rendue en
   * bas du détail avec un accent terracotta `#C28A6E` (économie). null = omise.
   * Affichée même si `items` est vide (cas crédit seul).
   */
  creditLine?: { label: string; valueLabel: string } | null;
}

export function ValueBreakdownList({
  items,
  ariaLabel = 'Détail de la valeur du pack',
  creditLine = null,
}: ValueBreakdownListProps): JSX.Element | null {
  if ((!items || items.length === 0) && !creditLine) return null;
  return (
    <ul
      aria-label={ariaLabel}
      data-testid="pack-value-breakdown"
      className="mx-auto mt-4 max-w-sm space-y-1.5 text-start text-sm"
    >
      {items.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          data-testid={`pack-value-item-${index}`}
          className={cn(
            'flex items-baseline justify-between gap-3 border-b border-encre/5 pb-1.5 last:border-b-0',
            item.muted && 'italic opacity-60',
          )}
        >
          <span className="text-encre/75">{item.label}</span>
          <span
            className={cn(
              'tabular-nums',
              item.muted ? 'text-encre/60' : 'font-medium text-encre',
            )}
          >
            {item.valueLabel}
          </span>
        </li>
      ))}
      {creditLine && (
        <li
          data-testid="pack-value-credit-line"
          className="flex items-baseline justify-between gap-3 border-t border-encre/10 pt-1.5"
        >
          <span className="text-encre/75">{creditLine.label}</span>
          <span className="font-semibold tabular-nums text-[#C28A6E]">
            {creditLine.valueLabel}
          </span>
        </li>
      )}
    </ul>
  );
}
