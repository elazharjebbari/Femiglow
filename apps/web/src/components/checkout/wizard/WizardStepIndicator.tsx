'use client';

import { cn } from '@/lib/utils/cn';
import type { StepName } from '@/lib/checkout/schemas/common';

/**
 * Indicateur visuel de progression dans le wizard.
 *
 * Conçu pour rester très sobre — la voix FemiGlow privilégie le silence
 * typographique sur les progress bars criardes. Trois états par step :
 *
 *  - `done`     : étape déjà validée (sous-tirée + opacité 100%)
 *  - `current`  : étape en cours (sous-tirée pleine + label gras)
 *  - `upcoming` : étape future (label en `text-encre/50`)
 *
 * Le composant est purement présentatif : aucune logique de navigation.
 */

interface WizardStepIndicatorProps {
  /** Steps à afficher dans l'ordre (ex. `['lead','address','payment','thank_you']`). */
  steps: StepName[];
  /** Step en cours (mise en valeur). */
  currentStep: StepName;
  /** Labels personnalisés (i18n). */
  labels?: Partial<Record<StepName, string>>;
  /**
   * Kolenda §5 W2 — durée estimée par step (« 60 s », « 30 s »…).
   * Rendue à côté du label si fournie ; sinon rétro-compat (pas affichée).
   */
  timesPerStep?: Partial<Record<StepName, string>>;
  className?: string;
}

const DEFAULT_LABELS: Record<StepName, string> = {
  cart_review: 'Panier',
  lead: 'Vos coordonnées',
  address: 'Livraison',
  payment: 'Paiement',
  thank_you: 'Confirmation',
};

export function WizardStepIndicator({
  steps,
  currentStep,
  labels,
  timesPerStep,
  className,
}: WizardStepIndicatorProps) {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <nav
      aria-label="Progression du wizard"
      className={cn('flex w-full justify-between gap-3', className)}
    >
      <ol className="flex w-full items-baseline gap-3 sm:gap-5">
        {steps.map((step, i) => {
          const state =
            i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming';
          const label = labels?.[step] ?? DEFAULT_LABELS[step];
          const time = timesPerStep?.[step];
          return (
            <li
              key={step}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex flex-1 flex-col gap-1.5 border-t pt-2',
                state === 'done' && 'border-encre/40 text-encre/70',
                state === 'current' && 'border-encre text-encre',
                state === 'upcoming' && 'border-encre/15 text-encre/40',
              )}
            >
              <span
                className={cn(
                  'text-[0.65rem] uppercase tracking-[0.18em]',
                  state === 'current' && 'font-medium',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'text-sm leading-tight',
                  state === 'current' && 'font-medium',
                )}
              >
                {label}
                {time && (
                  <span
                    data-testid={`wizard-step-time-${step}`}
                    className="ms-1 text-[10px] text-encre/45 tabular-nums"
                  >
                    · {time}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
