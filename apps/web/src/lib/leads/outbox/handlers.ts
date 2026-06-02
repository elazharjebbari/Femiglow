/**
 * OWBS — Registry des handlers d'effets `lead_event_outbox`.
 *
 * Chaque type d'effet (tracking serveur CAPI/GA4, webhook order/cart) est
 * exécuté par un handler enregistré ici. Les handlers réels (adapters vers
 * `serverFire` / `dispatchOrderWebhook`) sont câblés à la **conversion** (P5)
 * et à l'**abandon**, là où les events sont enqueués. En P2, le registry est
 * vide : le processor traite gracieusement un type sans handler (reschedule).
 *
 * Découplage volontaire (port/adapter) : le processor ne connaît que cette
 * interface, pas les intégrations concrètes.
 *
 * @see docs/checkout-leads-background-2026-06-01/01-architecture/architecture.md §3.6
 */
import type { LeadEventOutboxRow } from '@/lib/leads/db/schema-lead-outbox';
import type { LeadEffectType } from './lead-outbox-repo';

export type LeadEffectHandler = (row: LeadEventOutboxRow) => Promise<void>;

const registry = new Map<LeadEffectType, LeadEffectHandler>();

/** Enregistre (ou remplace) le handler d'un type d'effet. */
export function registerLeadEffectHandler(
  type: LeadEffectType,
  handler: LeadEffectHandler,
): void {
  registry.set(type, handler);
}

/** Récupère le handler d'un type, ou `undefined` si non câblé. */
export function getLeadEffectHandler(type: LeadEffectType): LeadEffectHandler | undefined {
  return registry.get(type);
}

/** Réinitialise le registry (tests uniquement). */
export function __clearLeadEffectHandlers(): void {
  registry.clear();
}
