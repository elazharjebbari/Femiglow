/**
 * CheckoutFunnelStepper — funnel checkout vertical 6 étapes.
 * cf. docs/analytics/05-onglets-specs.md §5.3
 *
 * Layout vertical : View Cart → Begin Checkout → Add Shipping → Add Payment →
 * Submit → Purchase. Pour chaque étape, barre proportionnelle au max + chiffre
 * absolu + delta vs étape précédente. Les "skip steps" (saut d'étape) sont
 * affichés en discret.
 */
import type {
  CheckoutFunnelStep,
  CheckoutStage,
} from '@/lib/analytics/queries/checkout';
import { formatNumber, formatPercent } from '@/lib/analytics/format';

import { ChartFrame } from '../primitives/ChartFrame';

const STAGE_LABELS: Record<CheckoutStage, string> = {
  view_cart: 'View Cart',
  begin_checkout: 'Begin Checkout',
  add_shipping: 'Add Shipping',
  add_payment: 'Add Payment',
  submit: 'Submit',
  purchase: 'Purchase',
};

const STAGE_BG: Record<CheckoutStage, string> = {
  view_cart: 'bg-stone-200',
  begin_checkout: 'bg-emerald-200',
  add_shipping: 'bg-sky-200',
  add_payment: 'bg-indigo-200',
  submit: 'bg-amber-200',
  purchase: 'bg-rose-200',
};

interface CheckoutFunnelStepperProps {
  steps: CheckoutFunnelStep[];
  loading?: boolean;
}

export function CheckoutFunnelStepper({
  steps,
  loading = false,
}: CheckoutFunnelStepperProps) {
  const baseline = steps[0]?.sessions ?? 0;
  const isEmpty = baseline === 0;

  return (
    <ChartFrame
      title="Funnel checkout"
      description="Sessions ayant atteint chaque étape (cumul depuis View Cart)."
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aucune session sur la période — pas de funnel à tracer."
      height={360}
    >
      <ol
        data-testid="checkout-funnel-stepper"
        className="flex h-full flex-col justify-between gap-2"
      >
        {steps.map((s, i) => {
          const ratio = baseline > 0 ? s.sessions / baseline : 0;
          const widthPct = Math.max(4, Math.round(ratio * 100));
          const dropoff = s.dropoffToNext;
          const prev = i > 0 ? steps[i - 1] : null;
          // Drop-off vs étape précédente (information principale du Stepper).
          const dropFromPrev =
            prev && prev.sessions > 0
              ? 1 - s.sessions / prev.sessions
              : null;
          return (
            <li
              key={s.stage}
              data-testid={`checkout-step-${s.stage}`}
              className="flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium uppercase tracking-wide text-stone-600">
                  {STAGE_LABELS[s.stage]}
                </span>
                <span className="text-stone-400">
                  {dropFromPrev !== null && dropFromPrev > 0 ? (
                    <span className="text-rose-500">
                      −{formatPercent(dropFromPrev, 0)}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-stone-100">
                  <div
                    className={`h-full ${STAGE_BG[s.stage]} transition-all`}
                    style={{ width: `${widthPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-display text-base tabular-nums text-stone-900">
                  {formatNumber(s.sessions)}
                </span>
              </div>
              {dropoff !== null && i < steps.length - 1 ? (
                <span className="self-end text-[11px] text-stone-400">
                  drop → {formatPercent(dropoff, 1)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
