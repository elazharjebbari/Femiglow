/**
 * FunnelDropOff — bar chart % d'abandon entre étapes adjacentes.
 * cf. docs/analytics/05-onglets-specs.md §3.6
 *
 * Couleurs : brume si < 30 %, amber si 30–60 %, rose si > 60 %. Aide à
 * identifier d'un coup d'œil le step "rouge" qui mérite attention.
 */
import type { FunnelStep } from '@/lib/analytics/queries/funnel';
import { formatPercent } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

interface FunnelDropOffProps {
  steps: FunnelStep[];
  loading?: boolean;
}

const STAGE_LABELS: Record<FunnelStep['stage'], string> = {
  view: 'View',
  engage: 'Engage',
  cta: 'CTA',
  checkout: 'Checkout',
  purchase: 'Purchase',
};

function colorForRate(rate: number): string {
  if (rate > 0.6) return 'bg-rose-400';
  if (rate >= 0.3) return 'bg-amber-300';
  return 'bg-stone-300';
}

export function FunnelDropOff({ steps, loading = false }: FunnelDropOffProps) {
  const transitions = steps
    .slice(0, -1)
    .map((s, i) => ({
      from: s.stage,
      to: steps[i + 1]!.stage,
      rate: s.dropoffToNext,
    }))
    .filter((t): t is { from: FunnelStep['stage']; to: FunnelStep['stage']; rate: number } =>
      t.rate !== null,
    );
  const isEmpty = transitions.length === 0;

  return (
    <ChartFrame
      title="Drop-off entre étapes"
      description="% d'abandon entre une étape et la suivante. > 60 % = priorité d'optimisation."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Pas assez de sessions pour calculer un drop-off."
      height={220}
    >
      <ul
        data-testid="funnel-dropoff"
        className="flex h-full flex-col justify-around gap-2"
      >
        {transitions.map((t) => (
          <li key={`${t.from}-${t.to}`} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 text-stone-500">
              {STAGE_LABELS[t.from]} → {STAGE_LABELS[t.to]}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full ${colorForRate(t.rate)}`}
                style={{ width: `${Math.min(100, t.rate * 100)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-stone-900">
              {formatPercent(t.rate, 1)}
            </span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
