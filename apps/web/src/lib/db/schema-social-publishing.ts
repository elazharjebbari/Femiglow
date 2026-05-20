import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './schema';
import { contentPosts } from './schema-content-studio';

export const socialAccounts = pgTable(
  'social_account',
  {
    id: text('id').primaryKey(),
    provider: text('provider', { enum: ['dry_run', 'meta_graph', 'postiz'] }).notNull(),
    platform: text('platform', { enum: ['instagram', 'facebook'] }).notNull(),
    remoteId: text('remote_id').notNull(),
    name: text('name').notNull(),
    status: text('status', {
      enum: ['active', 'disabled', 'token_expired', 'permission_missing'],
    }).notNull().default('active'),
    capabilities: jsonb('capabilities_json').notNull().default([]),
    metadata: jsonb('metadata_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerPlatformIdx: index('social_account_provider_platform_idx').on(t.provider, t.platform),
    remoteUnique: uniqueIndex('social_account_provider_remote_unique').on(t.provider, t.remoteId),
    statusIdx: index('social_account_status_idx').on(t.status, t.updatedAt),
  }),
);

export const socialCredentials = pgTable(
  'social_credential',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'cascade' }),
    secretRef: text('secret_ref').notNull(),
    scopes: jsonb('scopes_json').notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    metadata: jsonb('metadata_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountIdx: index('social_credential_account_idx').on(t.accountId),
    expiresIdx: index('social_credential_expires_idx').on(t.expiresAt),
  }),
);

export const socialPublishJobs = pgTable(
  'social_publish_job',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'restrict' }),
    provider: text('provider', { enum: ['dry_run', 'meta_graph', 'postiz'] }).notNull(),
    platform: text('platform', { enum: ['instagram', 'facebook'] }).notNull(),
    format: text('format', { enum: ['post', 'story', 'reel', 'carousel'] }).notNull(),
    status: text('status', {
      enum: ['draft', 'approved', 'queued', 'publishing', 'published', 'failed', 'cancelled'],
    }).notNull().default('queued'),
    idempotencyKey: text('idempotency_key').notNull(),
    content: jsonb('content_json').notNull().default({}),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: jsonb('last_error_json'),
    requestedBy: text('requested_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex('social_publish_job_idempotency_unique').on(t.idempotencyKey),
    postIdx: index('social_publish_job_post_idx').on(t.postId, t.createdAt),
    accountStatusIdx: index('social_publish_job_account_status_idx').on(t.accountId, t.status),
    statusScheduledIdx: index('social_publish_job_status_scheduled_idx').on(t.status, t.scheduledAt),
  }),
);

export const socialPublishAttempts = pgTable(
  'social_publish_attempt',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => socialPublishJobs.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    provider: text('provider', { enum: ['dry_run', 'meta_graph', 'postiz'] }).notNull(),
    status: text('status', { enum: ['succeeded', 'failed'] }).notNull(),
    request: jsonb('request_json').notNull().default({}),
    response: jsonb('response_json').notNull().default({}),
    error: jsonb('error_json'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('social_publish_attempt_job_idx').on(t.jobId, t.attemptNumber),
  }),
);

export const socialPublications = pgTable(
  'social_publication',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => socialPublishJobs.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => socialAccounts.id, { onDelete: 'restrict' }),
    provider: text('provider', { enum: ['dry_run', 'meta_graph', 'postiz'] }).notNull(),
    platform: text('platform', { enum: ['instagram', 'facebook'] }).notNull(),
    remoteId: text('remote_id').notNull(),
    permalink: text('permalink'),
    status: text('status', { enum: ['published', 'removed', 'unknown'] }).notNull().default('published'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobUnique: uniqueIndex('social_publication_job_unique').on(t.jobId),
    remoteUnique: uniqueIndex('social_publication_provider_remote_unique').on(t.provider, t.remoteId),
    postIdx: index('social_publication_post_idx').on(t.postId, t.createdAt),
  }),
);

export const socialPublishEvents = pgTable(
  'social_publish_event',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => socialPublishJobs.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    message: text('message').notNull(),
    metadata: jsonb('metadata_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('social_publish_event_job_idx').on(t.jobId, t.createdAt),
  }),
);
