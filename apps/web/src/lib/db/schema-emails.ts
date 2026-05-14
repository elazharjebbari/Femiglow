/**
 * Emailing schema — 10 tables + 2 matviews + indexes.
 *
 * Loaded via drizzle.config.ts. See docs/emailing/02-data-model.md for the full
 * design rationale, retention policies, and matview SQL.
 */
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// — Enums — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailOutboxStatus = pgEnum('email_outbox_status', [
  'pending',
  'sending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced_soft',
  'bounced_permanent',
  'suppressed',
  'dlq',
]);

export const emailBounceType = pgEnum('email_bounce_type', [
  'soft',
  'hard',
  'complaint',
  'unsubscribe',
]);

export const emailEventType = pgEnum('email_event_type', [
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced_soft',
  'bounced_hard',
  'complaint',
  'unsubscribed',
  'failed',
  'retried',
  'suppressed',
  'dlq',
]);

export const emailEventSource = pgEnum('email_event_source', [
  'stalwart',
  'listmonk',
  'app',
]);

export const emailTemplateCategory = pgEnum('email_template_category', [
  'transactional',
  'broadcast',
  'automation',
]);

export const emailAudienceType = pgEnum('email_audience_type', ['public', 'private']);
export const emailAudienceOptin = pgEnum('email_audience_optin', ['single', 'double']);

export const emailCampaignStatus = pgEnum('email_campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled',
  'failed',
]);

export const emailSubscriberStatus = pgEnum('email_subscriber_status', [
  'pending',
  'enabled',
  'disabled',
  'blocklisted',
]);

export const emailSuppressionReason = pgEnum('email_suppression_reason', [
  'hard_bounce',
  'soft_bounce_repeated',
  'complaint',
  'unsubscribe',
  'manual_admin',
  'cndp_request',
  'invalid_format',
]);

export const emailSuppressionSource = pgEnum('email_suppression_source', [
  'stalwart',
  'listmonk',
  'manual',
  'cndp',
]);

export const emailAutomationTriggerType = pgEnum('email_automation_trigger_type', [
  'event',
  'schedule',
  'subscription',
  'webhook',
]);

export const emailAutomationRunStatus = pgEnum('email_automation_run_status', [
  'running',
  'completed',
  'cancelled',
  'errored',
]);

// — email_outbox — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    template: text('template').notNull(),
    templateVersion: integer('template_version').notNull(),
    toEmail: text('to_email').notNull(),
    toName: text('to_name'),
    fromEmail: text('from_email').notNull(),
    replyTo: text('reply_to'),
    subject: text('subject').notNull(),
    payloadJson: jsonb('payload_json').notNull().default({}),
    htmlSnapshot: text('html_snapshot'),
    textSnapshot: text('text_snapshot'),
    status: emailOutboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    nextRetry: timestamp('next_retry', { withTimezone: true }),
    lastError: text('last_error'),
    smtpMessageId: text('smtp_message_id'),
    smtpResponse: text('smtp_response'),
    queueId: text('queue_id'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    bouncedAt: timestamp('bounced_at', { withTimezone: true }),
    bounceReason: text('bounce_reason'),
    bounceType: emailBounceType('bounce_type'),
    source: text('source'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idemUnique: uniqueIndex('email_outbox_idem_unique').on(t.idempotencyKey),
    statusIdx: index('email_outbox_status_idx').on(t.status, t.nextRetry),
    toEmailIdx: index('email_outbox_to_email_idx').on(t.toEmail),
    createdAtIdx: index('email_outbox_created_at_idx').on(t.createdAt),
    templateIdx: index('email_outbox_template_idx').on(t.template),
    smtpMessageIdIdx: index('email_outbox_smtp_message_id_idx').on(t.smtpMessageId),
  }),
);

// — email_event — — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailEvent = pgTable(
  'email_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    outboxId: text('outbox_id').references(() => emailOutbox.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id'),
    subscriberId: text('subscriber_id'),
    type: emailEventType('type').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    source: emailEventSource('source').notNull(),
    rawJson: jsonb('raw_json'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    linkUrl: text('link_url'),
  },
  (t) => ({
    outboxIdx: index('email_event_outbox_idx').on(t.outboxId, t.ts),
    campaignIdx: index('email_event_campaign_idx').on(t.campaignId, t.ts),
    tsIdx: index('email_event_ts_idx').on(t.ts),
    typeIdx: index('email_event_type_idx').on(t.type),
  }),
);

// — email_template_meta — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailTemplateMeta = pgTable('email_template_meta', {
  slug: text('slug').primaryKey(),
  displayName: text('display_name').notNull(),
  category: emailTemplateCategory('category').notNull(),
  description: text('description'),
  variables: jsonb('variables').notNull().default([]),
  active: boolean('active').notNull().default(true),
  version: integer('version').notNull().default(1),
  listmonkTemplateId: integer('listmonk_template_id'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// — email_audience_link — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailAudienceLink = pgTable(
  'email_audience_link',
  {
    id: text('id').primaryKey(),
    listmonkListId: integer('listmonk_list_id').notNull(),
    name: text('name').notNull(),
    type: emailAudienceType('type').notNull(),
    optinMode: emailAudienceOptin('optin_mode').notNull().default('double'),
    segmentRules: jsonb('segment_rules'),
    subscriberCount: integer('subscriber_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => ({
    lmIdUnique: uniqueIndex('email_audience_link_lm_id_unique').on(t.listmonkListId),
  }),
);

// — email_campaign_link — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailCampaignLink = pgTable(
  'email_campaign_link',
  {
    id: text('id').primaryKey(),
    listmonkCampaignId: integer('listmonk_campaign_id'),
    status: emailCampaignStatus('status').notNull().default('draft'),
    name: text('name').notNull(),
    subject: text('subject').notNull().default(''),
    preheader: text('preheader'),
    templateSlug: text('template_slug').references(() => emailTemplateMeta.slug),
    audienceLinkIds: jsonb('audience_link_ids').notNull().default([]),
    payloadJson: jsonb('payload_json').notNull().default({}),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    sentCount: integer('sent_count').notNull().default(0),
    deliveredCount: integer('delivered_count').notNull().default(0),
    openCount: integer('open_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),
    bounceCount: integer('bounce_count').notNull().default(0),
    unsubscribeCount: integer('unsubscribe_count').notNull().default(0),
    abVariant: text('ab_variant'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    lmCampaignUnique: uniqueIndex('email_campaign_link_lm_unique').on(t.listmonkCampaignId),
    statusIdx: index('email_campaign_link_status_idx').on(t.status, t.scheduledFor),
    createdAtIdx: index('email_campaign_link_created_at_idx').on(t.createdAt),
  }),
);

// — email_subscriber_link — — — — — — — — — — — — — — — — — — — — — — — —

export const emailSubscriberLink = pgTable(
  'email_subscriber_link',
  {
    email: text('email').primaryKey(),
    listmonkSubscriberId: integer('listmonk_subscriber_id'),
    userId: text('user_id'),
    firstName: text('first_name'),
    consentAt: timestamp('consent_at', { withTimezone: true }),
    consentSource: text('consent_source'),
    doubleOptinConfirmedAt: timestamp('double_optin_confirmed_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    status: emailSubscriberStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
  },
  (t) => ({
    lmSubUnique: uniqueIndex('email_subscriber_link_lm_unique').on(t.listmonkSubscriberId),
    statusIdx: index('email_subscriber_link_status_idx').on(t.status),
  }),
);

// — email_suppression — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailSuppression = pgTable(
  'email_suppression',
  {
    email: text('email').primaryKey(),
    reason: emailSuppressionReason('reason').notNull(),
    detail: text('detail'),
    since: timestamp('since', { withTimezone: true }).notNull().defaultNow(),
    source: emailSuppressionSource('source').notNull(),
  },
  (t) => ({
    sinceIdx: index('email_suppression_since_idx').on(t.since),
    reasonIdx: index('email_suppression_reason_idx').on(t.reason),
  }),
);

// — email_automation — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailAutomation = pgTable(
  'email_automation',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    triggerType: emailAutomationTriggerType('trigger_type').notNull(),
    triggerConfig: jsonb('trigger_config').notNull(),
    steps: jsonb('steps').notNull(),
    active: boolean('active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('email_automation_slug_unique').on(t.slug),
    activeIdx: index('email_automation_active_idx').on(t.active),
  }),
);

// — email_automation_run — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailAutomationRun = pgTable(
  'email_automation_run',
  {
    id: text('id').primaryKey(),
    automationId: text('automation_id')
      .notNull()
      .references(() => emailAutomation.id),
    recipientEmail: text('recipient_email').notNull(),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    currentStep: integer('current_step').notNull().default(0),
    status: emailAutomationRunStatus('status').notNull().default('running'),
    contextJson: jsonb('context_json').notNull().default({}),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    outboxIds: jsonb('outbox_ids').notNull().default([]),
  },
  (t) => ({
    automationIdx: index('email_automation_run_automation_idx').on(t.automationId, t.status),
    // Partial index for active runs only — narrows the scan in the runner cron.
    nextActionIdx: index('email_automation_run_next_action_idx').on(t.nextActionAt),
    emailIdx: index('email_automation_run_email_idx').on(t.recipientEmail),
  }),
);

// — email_settings — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export const emailSettings = pgTable('email_settings', {
  key: text('key').primaryKey(),
  json: jsonb('json').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// — admin_email_view (M5.1) — — — — — — — — — — — — — — — — — — — — — — — —
// Saved views per-admin (transactional cockpit, audiences, automation).
// is_system=true → vue prédéfinie système (owner_email='system'), lecture seule.

export const adminEmailView = pgTable(
  'admin_email_view',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerEmail: text('owner_email').notNull(),
    name: text('name').notNull(),
    scope: text('scope', { enum: ['transactional', 'campaigns', 'automation'] }).notNull(),
    filterState: jsonb('filter_state').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueOwnerScope: uniqueIndex('admin_email_view_unique_per_owner').on(
      t.ownerEmail,
      t.scope,
      t.name,
    ),
    ownerIdx: index('idx_admin_email_view_owner').on(t.ownerEmail, t.scope),
    systemIdx: index('idx_admin_email_view_system').on(t.scope, t.isSystem),
  }),
);

// — Inferred types — — — — — — — — — — — — — — — — — — — — — — — — — — — —

export type EmailOutboxRow = typeof emailOutbox.$inferSelect;
export type EmailOutboxInsert = typeof emailOutbox.$inferInsert;
export type EmailEventRow = typeof emailEvent.$inferSelect;
export type EmailEventInsert = typeof emailEvent.$inferInsert;
export type EmailTemplateMetaRow = typeof emailTemplateMeta.$inferSelect;
export type EmailTemplateMetaInsert = typeof emailTemplateMeta.$inferInsert;
export type EmailAudienceLinkRow = typeof emailAudienceLink.$inferSelect;
export type EmailCampaignLinkRow = typeof emailCampaignLink.$inferSelect;
export type EmailSubscriberLinkRow = typeof emailSubscriberLink.$inferSelect;
export type EmailSuppressionRow = typeof emailSuppression.$inferSelect;
export type EmailSuppressionInsert = typeof emailSuppression.$inferInsert;
export type EmailAutomationRow = typeof emailAutomation.$inferSelect;
export type EmailAutomationRunRow = typeof emailAutomationRun.$inferSelect;
export type EmailSettingsRow = typeof emailSettings.$inferSelect;
export type AdminEmailViewRow = typeof adminEmailView.$inferSelect;
export type AdminEmailViewInsert = typeof adminEmailView.$inferInsert;
export type AdminEmailViewScope = 'transactional' | 'campaigns' | 'automation';

export type EmailOutboxStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'failed'
  | 'bounced_soft'
  | 'bounced_permanent'
  | 'suppressed'
  | 'dlq';
