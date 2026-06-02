/**
 * OWBS (F08-S13) — Annonceur d'étape pour lecteurs d'écran.
 *
 * En flux optimiste, le changement d'étape est **instantané** (pas de reload,
 * pas de réseau) : sans région live, un utilisateur de lecteur d'écran n'apprend
 * pas qu'il a changé d'étape. Cette région `aria-live="polite"` (visuellement
 * masquée) annonce le libellé de l'étape courante à chaque changement.
 *
 * La région est **toujours montée** (au niveau du shell) pour que les mises à
 * jour de son contenu soient bien annoncées (les live regions n'annoncent que
 * les changements d'un nœud déjà présent).
 */
export function WizardStepAnnouncer({ label }: { label: string }): JSX.Element {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="wizard-step-announcer"
      className="sr-only"
    >
      {label}
    </p>
  );
}
