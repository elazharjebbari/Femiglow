/**
 * CheckoutAbandonedFields — top 10 champs sur lesquels les users ont abandonné.
 * cf. docs/analytics/05-onglets-specs.md §5.4-C
 *
 * Source : `form_abandon` events ; `last_field_id` = dernier champ ayant reçu
 * `form_field_blur` avant la quitte (calculé par `useFormTracking` côté client).
 *
 * Mini-bars horizontales pour visualiser le ratio sans empiler une DataTable
 * supplémentaire dans le layout.
 */
import type { CheckoutAbandonedField } from '@/lib/analytics/queries/checkout';
import { formatNumber } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

interface CheckoutAbandonedFieldsProps {
  rows: CheckoutAbandonedField[];
  loading?: boolean;
}

export function CheckoutAbandonedFields({
  rows,
  loading = false,
}: CheckoutAbandonedFieldsProps) {
  const max = rows.reduce((m, r) => Math.max(m, r.abandons), 0);
  const isEmpty = rows.length === 0;

  return (
    <ChartFrame
      title="Champs abandonnés"
      description="Dernier champ avant départ (top 10)."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aucun abandon formulaire détecté sur la période."
      height={Math.max(180, Math.min(440, rows.length * 36 + 24))}
    >
      <ul
        data-testid="checkout-abandoned-fields"
        className="flex h-full flex-col gap-2 overflow-y-auto pr-1"
      >
        {rows.map((r) => {
          const ratio = max > 0 ? r.abandons / max : 0;
          return (
            <li key={r.lastField} className="flex items-center gap-3 text-sm">
              <span
                className="w-44 shrink-0 truncate font-mono text-xs text-stone-700"
                title={r.lastField}
              >
                {r.lastField}
              </span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-amber-300"
                  style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums text-stone-900">
                {formatNumber(r.abandons)}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
