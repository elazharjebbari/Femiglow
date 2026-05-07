/**
 * FunnelGlobal — visualisation des 5 étapes du funnel principal.
 * cf. docs/analytics/05-onglets-specs.md §3.2
 *
 * Layout : 5 colonnes (View → Engage → CTA → Checkout → Purchase) avec barre
 * proportionnelle à la 1ère étape, chiffre absolu, taux de progression depuis
 * l'étape précédente, et médiane time-to-next dessous.
 */
import type { FunnelStep } from '@/lib/analytics/queries/funnel';
import { formatDuration, formatNumber, formatPercent } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

const STAGE_LABELS: Record<FunnelStep['stage'], string> = {
  view: 'View',
  engage: 'Engage',
  cta: 'CTA',
  checkout: 'Checkout',
  purchase: 'Purchase',
};

const STAGE_BG: Record<FunnelStep['stage'], string> = {
  view: 'bg-stone-100',
  engage: 'bg-emerald-100',
  cta: 'bg-sky-100',
  checkout: 'bg-amber-100',
  purchase: 'bg-rose-100',
};

interface FunnelGlobalProps {
  steps: FunnelStep[];
  loading?: boolean;
}

export function FunnelGlobal({ steps, loading = false }: FunnelGlobalProps) {
  const baseline = steps[0]?.sessions ?? 0;
  const isEmpty = baseline === 0;

  return (
    <ChartFrame
      title="Funnel principal"
      description="Sessions ayant atteint chaque étape (cumul depuis View)."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aucune session sur la période — pas de funnel à tracer."
      height={260}
    >
      <ol
        data-testid="funnel-global"
        className="grid h-full grid-cols-5 items-end gap-3"
      >
        {steps.map((s, i) => {
          const ratio = baseline > 0 ? s.sessions / baseline : 0;
          const heightPct = Math.max(6, Math.round(ratio * 100));
          const prog = s.progressionFromPrevious;
          const time = s.medianTimeToNextSeconds;
          return (
            <li
              key={s.stage}
              className="flex h-full flex-col items-stretch justify-end gap-2"
            >
              <div className="text-center text-xs font-medium uppercase tracking-wide text-stone-500">
                {STAGE_LABELS[s.stage]}
              </div>
              <div className="flex h-full items-end">
                <div
                  data-testid={`funnel-bar-${s.stage}`}
                  className={`w-full rounded-t-md ${STAGE_BG[s.stage]} transition-all`}
                  style={{ height: `${heightPct}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-center">
                <div className="font-display text-lg font-medium text-stone-900">
                  {formatNumber(s.sessions)}
                </div>
                {i > 0 ? (
                  <div className="text-xs text-stone-500">
                    {prog !== null
                      ? `${formatPercent(prog, 1)} depuis ${STAGE_LABELS[steps[i - 1]!.stage]}`
                      : '—'}
                  </div>
                ) : (
                  <div className="text-xs text-stone-400">Baseline</div>
                )}
                {time !== null && i < steps.length - 1 ? (
                  <div className="mt-0.5 text-[11px] text-stone-400">
                    Δt&nbsp;{formatDuration(time)}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
