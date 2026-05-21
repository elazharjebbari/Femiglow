/**
 * `WizardCheckmark` — petit ✓ sauge-dark qui apparaît à droite du label
 * d'un champ quand le champ devient valide (Kolenda §5 W4 P5 — Attention
 * #2, micro-feedback de progression).
 *
 * Server Component pur. Visible uniquement si `visible=true` — sinon
 * retourne `null` (pas de réservation d'espace, pas de CLS).
 *
 * Animation `motion-safe:animate-fade-in` (cf. keyframe Tailwind config) —
 * désactivée auto sur `prefers-reduced-motion`.
 */
export interface WizardCheckmarkProps {
  visible: boolean;
  /** Classe additionnelle pour positionnement (ex. `absolute top-0 right-0`). */
  className?: string;
}

export function WizardCheckmark({
  visible,
  className,
}: WizardCheckmarkProps): JSX.Element | null {
  if (!visible) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="wizard-checkmark"
      className={`inline-block text-xs font-medium text-sauge-dark motion-safe:animate-fade-in ${className ?? ''}`}
    >
      ✓
    </span>
  );
}
