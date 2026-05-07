/**
 * CheckoutTimeToSubmit — histogramme P25/P50/P75/P95 du time-to-submit.
 * cf. docs/analytics/05-onglets-specs.md §5.4-B
 *
 * Affichage : 12 buckets de 50 s sur l'axe X (0..600s), Y = sessions, lignes
 * verticales pour P25 (gris), P50 (sauge), P75 (sauge), P95 (rose).
 *
 * Implémentation pragmatique : pas de Recharts ici, barres CSS pures pour
 * cohérence visuelle avec les autres mini-charts admin.
 */
import type { CheckoutTimeToSubmit } from '@/lib/analytics/queries/checkout';
import { formatNumber } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

interface CheckoutTimeToSubmitProps {
  data: CheckoutTimeToSubmit;
  loading?: boolean;
}

function fmtSec(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}\u202fs`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}\u202fmin` : `${m}\u202fmin\u202f${s}\u202fs`;
}

export function CheckoutTimeToSubmit({
  data,
  loading = false,
}: CheckoutTimeToSubmitProps) {
  const max = data.buckets.reduce((m, b) => Math.max(m, b.sessions), 0);
  const isEmpty = data.sampleSize === 0;
  const totalRange = data.buckets.length * 50; // 600s

  const percentilePosition = (p: number | null): number | null => {
    if (p === null) return null;
    return Math.min(100, Math.max(0, (p / totalRange) * 100));
  };

  return (
    <ChartFrame
      title="Time to submit"
      description="Durée begin_checkout → purchase. Bots <1s exclus, plafond 30 min."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aucune session avec begin_checkout suivi d'un purchase."
      height={260}
    >
      <div data-testid="checkout-tts" className="flex h-full flex-col gap-2">
        <div className="relative flex h-40 items-end gap-1 border-b border-stone-200 px-1">
          {data.buckets.map((b, i) => {
            const ratio = max > 0 ? b.sessions / max : 0;
            const heightPct = Math.max(b.sessions > 0 ? 4 : 0, Math.round(ratio * 100));
            return (
              <div
                key={i}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${b.fromSeconds}–${b.toSeconds}s : ${b.sessions} sessions`}
                data-testid={`tts-bucket-${i}`}
              >
                <div
                  className="w-full rounded-t-sm bg-emerald-200 transition-colors group-hover:bg-emerald-300"
                  style={{ height: `${heightPct}%` }}
                  aria-hidden="true"
                />
              </div>
            );
          })}
          {/* Lignes verticales P25/P50/P75/P95 */}
          {(['p25', 'p50', 'p75', 'p95'] as const).map((p) => {
            const pos = percentilePosition(data[p]);
            if (pos === null) return null;
            const colorClass =
              p === 'p95' ? 'bg-rose-400' : p === 'p50' ? 'bg-emerald-600' : 'bg-stone-400';
            return (
              <div
                key={p}
                className={`pointer-events-none absolute top-0 bottom-0 w-px ${colorClass}`}
                style={{ left: `${pos}%` }}
                aria-label={`${p} ${fmtSec(data[p])}`}
                data-testid={`tts-${p}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-stone-500">
          <span>0&nbsp;s</span>
          <span>300&nbsp;s</span>
          <span>600&nbsp;s</span>
        </div>
        <dl className="grid grid-cols-4 gap-2 pt-2 text-xs">
          <PercentileBox label="P25" value={fmtSec(data.p25)} />
          <PercentileBox label="P50" value={fmtSec(data.p50)} accent="emerald" />
          <PercentileBox label="P75" value={fmtSec(data.p75)} />
          <PercentileBox label="P95" value={fmtSec(data.p95)} accent="rose" />
        </dl>
        <p className="text-[11px] text-stone-400">
          Échantillon : {formatNumber(data.sampleSize)} sessions
        </p>
      </div>
    </ChartFrame>
  );
}

function PercentileBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'rose';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'rose'
        ? 'text-rose-700'
        : 'text-stone-700';
  return (
    <div className="flex flex-col rounded-md bg-stone-50 p-2">
      <dt className="text-[10px] uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className={`font-display text-sm tabular-nums ${accentClass}`}>
        {value}
      </dd>
    </div>
  );
}
