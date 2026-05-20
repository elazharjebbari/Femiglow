import { getCurrentDriftState } from '@/lib/db/queries/tracking/gtm-poka-yoke';
import { DriftBanner } from './DriftBanner';
import type { DriftReason } from '@/lib/tracking/gtm/sentinel-schemas';

/**
 * Server component qui charge l'état drift courant et rend le banner.
 * Tolère l'absence de DB (mode dev/test) → ne rend rien.
 */
export async function DriftBannerServer() {
  const state = await getCurrentDriftState().catch(() => null);
  if (!state || state.status === 'ok') return null;
  return (
    <DriftBanner
      status={state.status}
      humanMessage={humanizeFirstReason(state.reasons[0])}
      linkTo="/admin/tracking/plans"
    />
  );
}

function humanizeFirstReason(reason: DriftReason | undefined): string {
  if (!reason) return 'Drift détecté sur le tracking GTM.';
  switch (reason.code) {
    case 'mapping_version_drift':
      return `GTM exécute le mapping ${reason.got} alors que ${reason.expected} est actif côté admin.`;
    case 'config_version_drift':
      return `GTM exécute la config ${reason.got} alors que ${reason.expected} est attendue.`;
    case 'container_id_mismatch':
      return `Container ID en désaccord (${reason.got} ≠ ${reason.expected}). Workspace cible incorrect ?`;
    case 'bundle_mismatch':
      return `BundleId GTM (${reason.got}) ≠ admin (${reason.expected}). Cache GTM ou import partiel.`;
    case 'silence_excess':
      return `Aucun ping GTM reçu depuis ≥ ${reason.thresholdHours}h. Container GTM publié ?`;
    case 'manifest_flag_mismatch':
      return `Couche C signale : ${reason.details}. Un des 2 fichiers n'a probablement pas été importé.`;
  }
}
