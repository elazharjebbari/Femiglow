'use client';

import { WIZARD_STEPS, type WizardStep } from '@/lib/tracking/plan/client';

const STEP_LABELS: Record<WizardStep, string> = {
  providers: 'Outils',
  envProfiles: 'Identifiants',
  events: 'Événements',
  settings: 'Consentement',
  review: 'Revue',
};

export function WizardStepper({
  current,
  onSelect,
}: {
  current: WizardStep;
  onSelect: (step: WizardStep) => void;
}): JSX.Element {
  const currentIdx = WIZARD_STEPS.indexOf(current);
  return (
    <ol
      className="mb-6 flex flex-wrap items-center gap-2 text-xs"
      aria-label="Étapes du wizard"
    >
      {WIZARD_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={step} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(step)}
              aria-current={active ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                active
                  ? 'border-emerald-600 bg-emerald-50 font-medium text-emerald-800'
                  : done
                    ? 'border-emerald-300 bg-white text-emerald-700'
                    : 'border-stone-300 bg-white text-stone-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : done
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-stone-200 text-stone-700'
                }`}
              >
                {i + 1}
              </span>
              {STEP_LABELS[step]}
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <span aria-hidden className="text-stone-300">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
