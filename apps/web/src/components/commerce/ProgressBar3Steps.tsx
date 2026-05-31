'use client';

import { cn } from '@/lib/utils/cn';

export type CheckoutStep = 0 | 1 | 2;

interface ProgressBar3StepsProps {
  currentStep: CheckoutStep;
  labels: readonly [string, string, string];
  onStepClick?: (step: CheckoutStep) => void;
}

export function ProgressBar3Steps({
  currentStep,
  labels,
  onStepClick,
}: ProgressBar3StepsProps) {
  const fill = (currentStep / 2) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label="Progression de la commande"
      className="space-y-3"
    >
      <div className="relative h-px bg-encre/15">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 start-0 bg-encre transition-[width] duration-base ease-out-soft"
          style={{ width: `${fill}%` }}
        />
        <ol className="absolute inset-x-0 -top-3 flex justify-between">
          {labels.map((label, index) => {
            const stepIndex = index as CheckoutStep;
            const isActive = stepIndex === currentStep;
            const isDone = stepIndex < currentStep;
            const isFuture = stepIndex > currentStep;
            const canClick = isDone && Boolean(onStepClick);
            const node = (
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-medium tracking-tight transition-colors',
                  isActive && 'border-encre bg-encre text-creme',
                  isDone && 'border-encre bg-creme text-encre',
                  !isActive && !isDone && 'border-encre/20 bg-creme text-encre/40',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
            );
            return (
              <li key={label} className="flex flex-col items-center gap-2">
                {canClick ? (
                  <button
                    type="button"
                    onClick={() => onStepClick?.(stepIndex)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Étape ${index + 1} sur 3 : ${label}`}
                    className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-encre"
                  >
                    {node}
                  </button>
                ) : (
                  <span
                    aria-current={isActive ? 'step' : undefined}
                    aria-disabled={isFuture ? 'true' : undefined}
                  >
                    {node}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-encre/60">
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              'flex-1',
              index === 0 && 'text-start',
              index === 1 && 'text-center',
              index === 2 && 'text-end',
              index === currentStep && 'text-encre',
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
