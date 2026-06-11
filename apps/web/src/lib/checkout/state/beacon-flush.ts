/**
 * OWBS — Flush de dernier recours via `navigator.sendBeacon`.
 *
 * Au moment où l'onglet se ferme/se masque (`pagehide` / `visibilitychange:hidden`),
 * on envoie les envelopes encore en file vers `POST /api/checkout/lead/sync` :
 *   - `sendBeacon` est fire-and-forget et survit à la navigation (mais n'autorise
 *     pas d'en-têtes custom → la clé d'idempotence est portée dans le corps) ;
 *   - fallback `fetch(..., { keepalive: true })` si `sendBeacon` indisponible.
 *
 * Garantit le « zéro perte » du lead capturé même si l'utilisateur quitte avant
 * la conversion (NFR-02). Idempotent côté serveur (upsert-by-leadId).
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0005-beacon-flush.md
 */
import type { LeadSyncQueue } from './lead-sync-queue';

export const SYNC_ENDPOINT = '/api/checkout/lead/sync';

/**
 * Branche les listeners de flush de secours sur la file. Retourne un teardown.
 * No-op hors navigateur (SSR).
 */
export function installBeaconFlush(queue: LeadSyncQueue): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const flushNow = (): void => {
    const pending = queue.pending();
    if (pending.length === 0) return;
    const body = JSON.stringify({
      schemaVersion: 1,
      sentVia: 'beacon',
      envelopes: pending.map((e) => ({
        mutationId: e.mutationId,
        leadId: e.leadId,
        scope: e.scope,
        idempotencyKey: e.idempotencyKey,
        payload: e.payload,
      })),
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(SYNC_ENDPOINT, blob)) return;
      }
    } catch {
      /* sendBeacon indisponible / a échoué → fallback */
    }

    try {
      void fetch(SYNC_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    } catch {
      /* best-effort */
    }
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') flushNow();
  };
  const onPageHide = (): void => flushNow();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };
}
