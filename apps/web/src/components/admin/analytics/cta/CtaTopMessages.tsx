/**
 * CtaTopMessages — top 10 messages CTA par achats attribués (BarChart horizontal).
 * cf. docs/analytics/05-onglets-specs.md §4.4-A
 *
 * Lecture : "Composer mon rituel" → 67 achats, "Découvrir le Kit" → 12 achats.
 * On affiche le label EXACT (cf. acceptance §4 : pas l'ID).
 */
import type { CtaTopMessage } from '@/lib/analytics/queries/cta';
import { formatNumber, formatPercent } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

interface CtaTopMessagesProps {
  rows: CtaTopMessage[];
  loading?: boolean;
}

export function CtaTopMessages({ rows, loading = false }: CtaTopMessagesProps) {
  const max = rows.reduce((m, r) => Math.max(m, r.purchasesAttributed), 0);
  const isEmpty = rows.length === 0;

  return (
    <ChartFrame
      title="Top messages CTA"
      description="Achats attribués (last-click 7 j) par texte de bouton."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Pas encore d'achat attribuable à un message CTA."
      height={Math.max(180, Math.min(440, rows.length * 36 + 24))}
    >
      <ul data-testid="cta-top-messages" className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
        {rows.map((r) => {
          const ratio = max > 0 ? r.purchasesAttributed / max : 0;
          return (
            <li key={r.label} className="flex items-center gap-3 text-sm">
              <span
                className="w-44 shrink-0 truncate font-medium text-stone-900"
                title={r.label}
              >
                {r.label}
              </span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-rose-300"
                  style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-stone-900">
                {formatNumber(r.purchasesAttributed)}
              </span>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-stone-500">
                {formatPercent(r.conversionRate, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}
