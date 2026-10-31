/**
 * Sauvegarde de l'étape 2 champ par champ, dans la file de synchronisation : le
 * lead créé en tâche de fond part toujours avant ses champs, et le beacon reprend
 * ce qui reste à la fermeture de l'onglet.
 *
 * Chaque envoi remplace la valeur précédente, l'idempotence n'a donc pas lieu
 * d'être : la clé ne sert qu'au transport.
 */
import { createId } from '@/lib/checkout/client/random-id';
import type { PatchLeadAddressDraftInput } from '@/lib/checkout/schemas/lead';

import { getLeadSyncQueue } from './lead-sync-singleton';

export function enqueueAddressDraft(leadId: string, patch: PatchLeadAddressDraftInput): void {
  getLeadSyncQueue().enqueue({
    leadId,
    scope: 'address_draft',
    endpoint: `/api/checkout/lead/${encodeURIComponent(leadId)}/address/draft`,
    method: 'PATCH',
    idempotencyKey: createId('adraft'),
    payload: patch,
  });
}
