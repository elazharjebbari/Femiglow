/**
 * OWBS — Schéma Drizzle de la table `lead_event_outbox`.
 *
 * Boîte d'envoi des effets de bord **durables** d'un lead (tracking serveur
 * CAPI/GA4, webhook order.created / cart.abandoned). Calquée sur `email_outbox`
 * (cf. src/lib/db/schema-emails.ts) : écrite dans la même transaction que l'état
 * métier (transactional outbox), drainée par un worker cron avec retry/backoff.
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0004-lead-event-outbox.md
 * @see docs/checkout-leads-background-2026-06-01/02-data-flow/data-model.md §1.3
 */
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const leadEventOutboxStatus = pgEnum('lead_event_outbox_status', [
  'pending',
  'processing',
  'done',
  'dead',
]);

export const leadOutboxEventType = pgEnum('lead_outbox_event_type', [
  'purchase_capi',
  'purchase_ga4',
  'order_webhook',
  'cart_abandoned_webhook',
  'lead_capi',
]);

export const leadEventOutbox = pgTable(
  'lead_event_outbox',
  {
    id: text('id').primaryKey(),
    /** Type d'effet (handler cible). */
    type: leadOutboxEventType('type').notNull(),
    /** Lead concerné (FK logique → chat_lead.id ; pas de contrainte dure pour
     *  rester découplé et tolérer l'upsert dans la même transaction). */
    leadId: text('lead_id').notNull(),
    /** Clé d'idempotence d'effet (event_id / clé métier). */
    dedupeKey: text('dedupe_key').notNull(),
    /** Données nécessaires au handler (schéma lead-event-outbox.schema.json). */
    payload: jsonb('payload').notNull().default({}),
    status: leadEventOutboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(8),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Idempotence d'effet : au plus un effet par (type, lead, clé métier).
    dedupeUnique: uniqueIndex('lead_event_outbox_dedupe_unique').on(
      t.type,
      t.leadId,
      t.dedupeKey,
    ),
    // Drain du worker : WHERE status='pending' AND next_attempt_at <= now().
    drainIdx: index('lead_event_outbox_drain_idx').on(t.status, t.nextAttemptAt),
    leadIdx: index('lead_event_outbox_lead_idx').on(t.leadId),
  }),
);

export type LeadEventOutboxRow = typeof leadEventOutbox.$inferSelect;
export type LeadEventOutboxInsert = typeof leadEventOutbox.$inferInsert;
