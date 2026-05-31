/**
 * `NoCommitmentBadge` — bloc de réassurance « 0 € maintenant » affiché
 * juste au-dessus du CTA « Confirmer la commande » (Kolenda §5, Trust #1
 * loss aversion).
 *
 * Server Component pur — aucune dépendance navigateur. Le label + sub
 * sont overridables via props pour permettre une édition admin future
 * (W5 — KitWizardOverride.copy).
 */
export interface NoCommitmentBadgeProps {
  /** Label principal (défaut « Aucun paiement maintenant »). */
  label?: string;
  /** Sub italique sous le label. */
  sub?: string;
  /** CHA-232 — aria-label i18n (défaut FR pour le rendu hors contexte). */
  ariaLabel?: string;
}

export function NoCommitmentBadge({
  label = 'Aucun paiement maintenant',
  sub = 'Vous payez à la livraison, en main',
  ariaLabel = 'Garantie sans engagement',
}: NoCommitmentBadgeProps): JSX.Element {
  return (
    <section
      role="note"
      aria-label={ariaLabel}
      data-testid="wizard-no-commitment-badge"
      className="flex items-start gap-3 rounded border border-sauge-dark/25 bg-sauge-soft/40 p-3"
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-sauge-dark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="11" width="14" height="9" rx="1.5" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-encre">{label}</p>
        <p className="text-xs italic text-encre/65">{sub}</p>
      </div>
    </section>
  );
}
