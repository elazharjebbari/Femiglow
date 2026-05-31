/**
 * CHA-232 — Réconciliation du `formContext` props → store du wizard.
 *
 * La route (`/fr`, `/ar`, `/en`) est la SOURCE DE VÉRITÉ de la langue d'affichage.
 * Le `formContext` étant persisté (localStorage), un état d'une visite antérieure
 * pouvait masquer la langue de la route : c'est le bug où le wizard restait en
 * français sur `/ar`. Cette fonction décide si le store doit être réécrasé.
 *
 * Toute différence sur `formId`, `formMode`, `variantKey` OU `language` doit
 * déclencher la mise à jour — `language` inclus explicitement pour empêcher le
 * shadowing par un état persisté.
 */
import type { WizardFormContext } from './wizard-store';

export function shouldSyncFormContext(
  stored: WizardFormContext | null,
  incoming: WizardFormContext,
): boolean {
  if (!stored) return true;
  return (
    stored.formId !== incoming.formId ||
    stored.formMode !== incoming.formMode ||
    stored.variantKey !== incoming.variantKey ||
    stored.language !== incoming.language
  );
}
