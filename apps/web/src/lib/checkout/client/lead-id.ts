/**
 * OWBS — Génération / validation du `leadId` côté client.
 *
 * Dans le wizard optimiste, le `leadId` est généré **avant** tout appel réseau
 * (cf. ADR-0002) afin que les étapes suivantes (address/payment) ne dépendent
 * plus d'attendre la création serveur. Le serveur fait un upsert-by-leadId
 * idempotent à partir de cet identifiant.
 *
 * Format aligné avec `lib/ids.ts` (serveur) et `client/random-id.ts` :
 *   prefixe `cl_` + 20 caractères de l'alphabet [a-z0-9].
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0002-client-leadid-upsert.md
 */
import { createId } from './random-id';

/** Préfixe des identifiants de lead (chat_lead). */
export const LEAD_ID_PREFIX = 'cl';

/** Forme canonique d'un leadId : `cl_` + au moins 20 caractères [a-z0-9]. */
export const LEAD_ID_PATTERN = /^cl_[0-9a-z]{20,}$/;

/** Génère un nouvel identifiant de lead, universel (SSR + navigateur). */
export function newLeadId(): string {
  return createId(LEAD_ID_PREFIX);
}

/** Valide qu'une chaîne est un leadId bien formé (anti-injection serveur). */
export function isLeadId(value: unknown): value is string {
  return typeof value === 'string' && LEAD_ID_PATTERN.test(value);
}
