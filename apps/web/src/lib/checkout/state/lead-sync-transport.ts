/**
 * OWBS — Transport HTTP par défaut de la file de synchronisation.
 *
 * Envoie une envelope en `fetch(..., { keepalive: true })` avec l'`Idempotency-Key`
 * en en-tête, et classe le résultat (retryable vs non) en réutilisant
 * `parseApiError` / `isRetryableApiError` (réseau & 5xx = retryable, 4xx = non).
 *
 * @see ./lead-sync-queue.ts
 */
import { isRetryableApiError, parseApiError } from '@/lib/checkout/client/api-errors';
import type { Envelope, SyncTransport } from './lead-sync-queue';

export function createHttpSyncTransport(
  // IMPORTANT : on enveloppe `globalThis.fetch` au lieu de capturer `fetch`
  // détaché. En navigateur, appeler une référence `fetch` détachée lève
  // « Illegal invocation » (TypeError) car `this` doit être le `Window`. Le
  // wrapper appelle `globalThis.fetch(...)` avec le bon receiver, et lit la
  // valeur au moment de l'appel (compatible MSW qui patche globalThis.fetch).
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): SyncTransport {
  return {
    async send(env: Envelope) {
      try {
        const res = await fetchImpl(env.endpoint, {
          method: env.method,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': env.idempotencyKey,
          },
          body: JSON.stringify(env.payload),
          keepalive: true,
        });
        if (res.ok) return { ok: true as const };
        const err = await parseApiError(res);
        return { ok: false as const, retryable: isRetryableApiError(err), status: res.status };
      } catch {
        // Erreur réseau (offline, DNS, abort) → retryable.
        return { ok: false as const, retryable: true };
      }
    },
  };
}
