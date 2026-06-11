/**
 * OWBS — Accès aux flags du wizard optimiste.
 *
 * Le flag client lit directement `process.env.NEXT_PUBLIC_*` (inliné au build
 * par Next), à l'image de `lib/tracking/lead-purchase-cookie.ts`. Le flag
 * serveur passe par `@/lib/env`. Les deux doivent être ON pour activer le
 * chemin optimiste complet ; toute incohérence (client ON / serveur OFF) est
 * traitée comme OFF (garde-fou — cf. rollout §6).
 *
 * @see docs/checkout-leads-background-2026-06-01/05-runbook/rollout.md
 */

/** Vrai si le chemin optimiste est activé côté CLIENT (NEXT_PUBLIC mirror). */
export function isOptimisticWizardClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED === 'true';
}
