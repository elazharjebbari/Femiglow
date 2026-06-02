/**
 * OWBS — Singleton de la file de synchronisation lead (côté navigateur).
 *
 * Une seule instance par onglet : elle ré-hydrate son miroir `sessionStorage`
 * au premier accès (reprise après reload) puis tente un flush. Le beacon-flush
 * (P4) s'y branchera pour le flush de dernier recours.
 *
 * @see ./lead-sync-queue.ts
 */
import { installBeaconFlush } from './beacon-flush';
import { createLeadSyncQueue, type LeadSyncQueue } from './lead-sync-queue';
import { createHttpSyncTransport } from './lead-sync-transport';

let instance: LeadSyncQueue | null = null;

export function getLeadSyncQueue(): LeadSyncQueue {
  if (!instance) {
    instance = createLeadSyncQueue({ transport: createHttpSyncTransport() });
    // Reprise après un rechargement de page : on recharge les envelopes non
    // confirmées et on tente de les renvoyer (idempotent côté serveur).
    instance.hydrateFromMirror();
    void instance.flush();
    // Flush de dernier recours à la fermeture/masquage de l'onglet (zéro perte).
    installBeaconFlush(instance);
  }
  return instance;
}

/** Tests uniquement : réinitialise le singleton. */
export function __resetLeadSyncQueue(): void {
  instance = null;
}
