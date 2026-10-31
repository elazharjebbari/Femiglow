'use client';

import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';

export interface StepProgressLineProps {
  label: string;
  /** Avancement du parcours, de 0 à 100. */
  percent: number;
  onBack: () => void;
  backDisabled?: boolean;
}

/** Remplace l'indicateur à trois colonnes : une phrase, une ligne, un retour. */
export function StepProgressLine({ label, percent, onBack, backDisabled }: StepProgressLineProps) {
  const { t } = useWizardTranslation();
  return (
    <div className="space-y-1.5" data-testid="wizard-progress-line">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-medium text-encre">{label}</p>
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          aria-label={t.addressV2.backLabel}
          data-testid="wizard-address-back"
          // Cible tactile de 44 px sans agrandir la ligne.
          className="-my-3 shrink-0 py-3 text-xs text-encre-soft underline decoration-encre/30 underline-offset-4 disabled:opacity-40"
        >
          {t.addressV2.back}
        </button>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-[3px] overflow-hidden rounded-full bg-encre/10"
      >
        <div
          className="h-full rounded-full bg-sauge-dark transition-[width] duration-[320ms] ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
