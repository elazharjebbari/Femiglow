import { sql } from 'drizzle-orm';
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

export const trackingPlanStatus = pgEnum('tracking_plan_status', [
  'draft',
  'active',
  'archived',
]);

export const trackingPlanAuditAction = pgEnum('tracking_plan_audit_action', [
  'create',
  'update',
  'activate',
  'archive',
  'rollback',
  'delete',
  'restore',
]);

export const trackingPlans = pgTable(
  'tracking_plans',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    status: trackingPlanStatus('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    providers: jsonb('providers').notNull().default(sql`'[]'::jsonb`),
    envProfiles: jsonb('env_profiles').notNull().default(sql`'[]'::jsonb`),
    events: jsonb('events').notNull().default(sql`'[]'::jsonb`),
    settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('tracking_plans_status_idx').on(t.status),
    createdAtIdx: index('tracking_plans_created_at_idx').on(t.createdAt),
    uniqueActive: uniqueIndex('tracking_plans_unique_active')
      .on(t.status)
      .where(sql`status = 'active'`),
  }),
);

export const trackingPlanAudit = pgTable(
  'tracking_plan_audit',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id').notNull(),
    action: trackingPlanAuditAction('action').notNull(),
    actorEmail: text('actor_email').notNull(),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planIdx: index('tracking_plan_audit_plan_idx').on(t.planId),
    createdAtIdx: index('tracking_plan_audit_created_at_idx').on(t.createdAt),
  }),
);

export const trackingDefaults = pgTable('tracking_defaults', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  envHint: text('env_hint'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TrackingPlanRow = typeof trackingPlans.$inferSelect;
export type TrackingPlanInsert = typeof trackingPlans.$inferInsert;
export type TrackingPlanAuditRow = typeof trackingPlanAudit.$inferSelect;
export type TrackingDefaultsRow = typeof trackingDefaults.$inferSelect;
