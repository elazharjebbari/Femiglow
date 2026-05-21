/**
 * `TimeEstimateBadge` — microcopy « ≈ 90 secondes pour confirmer »
 * affichée sous le header du WizardShell (Kolenda §5, Attention #18 —
 * réduire l'anxiété temps perçue).
 *
 * Server Component pur, lecture seule.
 */
export interface TimeEstimateBadgeProps {
  label: string;
}

export function TimeEstimateBadge({
  label,
}: TimeEstimateBadgeProps): JSX.Element {
  return (
    <p
      data-testid="wizard-time-estimate"
      className="text-center text-xs italic text-encre/60"
    >
      {label}
    </p>
  );
}
