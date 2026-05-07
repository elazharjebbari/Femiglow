/**
 * LiveFunnel — funnel TOF/MOF/BOF/Conversion sur la fenêtre courante.
 * cf. docs/analytics/05-onglets-specs.md §2.4 E
 *
 * Affichage : 4 étapes horizontales avec volume + taux de progression.
 * Pas de Recharts ici — un simple grid suffit et reste lisible mobile.
 */
import { ChartFrame } from '@/components/admin/analytics/primitives';
import type { LiveFunnelStep, LiveWindow } from '@/lib/analytics/queries/live';

const STAGE_LABELS: Record<LiveFunnelStep['stage'], string> = {
  tof: 'Découverte',
  mof: 'Engagement',
  bof: 'Intention',
  conversion: 'Achat',
};

const STAGE_DESC: Record<LiveFunnelStep['stage'], string> = {
  tof: 'Page vue, item vu',
  mof: 'Scroll, vidéo, CTA vu',
  bof: 'Panier, checkout, lead',
  conversion: 'Achat',
};

interface LiveFunnelProps {
  steps: LiveFunnelStep[];
  window: LiveWindow;
}

export function LiveFunnel({ steps, window }: LiveFunnelProps) {
  const hasData = steps.some((s) => s.sessions > 0);
  const max = Math.max(1, ...steps.map((s) => s.sessions));

  return (
    <ChartFrame
      title="Funnel temps réel"
      description={`Sessions par étape sur les ${window === '1h' ? '60 dernières min' : window === '2h' ? '2 dernières heures' : '3 dernières heures'}`}
      isEmpty={!hasData}
      emptyMessage="Aucune session active sur la fenêtre."
      height={220}
    >
      <ol
        className="grid gap-3 sm:grid-cols-4"
        data-testid="live-funnel"
      >
        {steps.map((step, i) => {
          const prev = i === 0 ? null : steps[i - 1];
          const dropoff =
            prev && prev.sessions > 0
              ? 1 - step.sessions / prev.sessions
              : null;
          return (
            <li
              key={step.stage}
              className="flex flex-col gap-1 rounded-lg border border-stone-200 bg-white p-3"
            >
              <header className="flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
                  {STAGE_LABELS[step.stage]}
                </span>
                <span className="font-display text-2xl font-medium tabular-nums text-stone-900">
                  {step.sessions}
                </span>
              </header>
              <div
                aria-hidden
                className="h-1 overflow-hidden rounded-full bg-stone-100"
              >
                <div
                  className={`h-full ${step.stage === 'conversion' ? 'bg-emerald-500' : 'bg-stone-900'}`}
                  style={{ width: `${(step.sessions / max) * 100}%` }}
                />
              </div>
              <p className="text-xs text-stone-500">{STAGE_DESC[step.stage]}</p>
              {dropoff !== null ? (
                <p
                  className={`mt-1 text-xs tabular-nums ${
                    dropoff > 0.6
                      ? 'text-rose-600'
                      : dropoff > 0.3
                        ? 'text-amber-600'
                        : 'text-stone-500'
                  }`}
                >
                  {`-${(dropoff * 100).toFixed(0)}\u202f% vs étape précédente`}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
