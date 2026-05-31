/**
 * CHA-230 — Gestion des clés Idempotency-Key côté client.
 *
 * Pattern :
 *   - L'utilisateur clique "Continuer" sur le Step 2 (address).
 *   - On génère (ou récupère) une clé pour le couple `(leadId, 'address_update')`.
 *   - On envoie la requête avec `Idempotency-Key: <key>`.
 *   - Si la requête échoue (network, 5xx), un retry réutilise la MÊME clé →
 *     le serveur replay la réponse au lieu de double-écrire.
 *   - Sur succès, on PURGE la clé pour éviter qu'un retry "tardif" du user
 *     (back navigation) ne replay une réponse obsolète.
 *
 * Storage : `sessionStorage` (durée onglet). On ne persiste pas en
 * localStorage pour éviter qu'une vieille clé d'il y a 24h+ rejoue une
 * mutation déjà commit en backend.
 */
import { createId } from '@/lib/checkout/client/random-id';

/** Scopes alignés avec le serveur (cf. idempotency-repo.ts). */
export type IdempotencyScope =
  | 'lead_create'
  | 'address_update'
  | 'payment_select'
  | 'order_create'
  | 'email_optin'
  | 'stock_notify';

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
  );
}

function storageKey(scope: IdempotencyScope, resourceId: string | null): string {
  // `resourceId` peut être null pour les scopes "création" (lead_create,
  // stock_notify). On préfixe avec `__new__` pour éviter une collision avec
  // un éventuel leadId nommé "null".
  const id = resourceId ?? '__new__';
  return `femiglow.wizard.idem.${scope}.${id}`;
}

/**
 * Récupère ou crée la clé idempotency-key associée au couple (scope,
 * resourceId). Toujours la MÊME clé tant qu'elle n'a pas été `consume`'d.
 *
 * @param scope        Type de mutation (mirror du serveur).
 * @param resourceId   Identifiant de la ressource (`leadId` ou null pour
 *                     les créations).
 */
export function getOrCreateIdempotencyKey(
  scope: IdempotencyScope,
  resourceId: string | null = null,
): string {
  if (!isBrowser()) {
    // SSR ou tests : on génère une clé volatile à chaque appel — pas idéal
    // mais le serveur tolère l'absence de clé.
    return createId('idem');
  }
  const key = storageKey(scope, resourceId);
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const fresh = createId('idem');
    window.sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return createId('idem');
  }
}

/**
 * Purge la clé après un succès. Permet à un retry futur de générer une
 * nouvelle clé propre (utile si l'utilisateur revient en arrière puis re-
 * soumet avec un payload différent — l'idempotency_conflict serait sinon
 * inutilement déclenché).
 */
export function consumeIdempotencyKey(
  scope: IdempotencyScope,
  resourceId: string | null = null,
): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(storageKey(scope, resourceId));
  } catch {
    // no-op
  }
}

/** Purge tous les keys du wizard (debug / reset). */
export function purgeAllIdempotencyKeys(): void {
  if (!isBrowser()) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith('femiglow.wizard.idem.')) toRemove.push(k);
    }
    for (const k of toRemove) window.sessionStorage.removeItem(k);
  } catch {
    // no-op
  }
}
