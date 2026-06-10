import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { adminUsers, media } from './schema';

export const contentCampaigns = pgTable(
  'content_campaign',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    objective: text('objective').notNull(),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('content_campaign_status_idx').on(t.status, t.createdAt),
  }),
);

export const contentIdeas = pgTable(
  'content_idea',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').references(() => contentCampaigns.id, {
      onDelete: 'set null',
    }),
    pillar: text('pillar').notNull(),
    objective: text('objective').notNull(),
    platform: text('platform').notNull(),
    format: text('format').notNull(),
    prompt: text('prompt').notNull(),
    sourceType: text('source_type'),
    sourceRef: text('source_ref'),
    rejectionReason: text('rejectionReason'),
    status: text('status').notNull().default('idea'),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('content_idea_status_idx').on(t.status, t.createdAt),
    pillarIdx: index('content_idea_pillar_idx').on(t.pillar, t.createdAt),
  }),
);

export const contentBriefs = pgTable(
  'content_brief',
  {
    id: text('id').primaryKey(),
    ideaId: text('idea_id')
      .notNull()
      .references(() => contentIdeas.id, { onDelete: 'cascade' }),
    angle: text('angle').notNull(),
    proof: text('proof'),
    cta: text('cta').notNull(),
    mediaDirection: text('media_direction'),
    constraints: jsonb('constraints_json').notNull().default({}),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ideaVersionUnique: uniqueIndex('content_brief_idea_version_unique').on(
      t.ideaId,
      t.version,
    ),
  }),
);

export const contentDrafts = pgTable(
  'content_draft',
  {
    id: text('id').primaryKey(),
    briefId: text('brief_id')
      .notNull()
      .references(() => contentBriefs.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    format: text('format').notNull(),
    variantLabel: text('variant_label').notNull(),
    caption: text('caption').notNull(),
    hook: text('hook'),
    cta: text('cta'),
    altText: text('alt_text'),
    hashtags: jsonb('hashtags_json').notNull().default([]),
    status: text('status').notNull().default('generated'),
    rejectionReason: text('rejectionReason'),
    parentDraftId: text('parentDraftId'),
    scoreTotal: integer('score_total'),
    editedBy: text('edited_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('content_draft_status_idx').on(t.status, t.createdAt),
    briefIdx: index('content_draft_brief_idx').on(t.briefId),
    parentIdx: index('content_draft_parent_idx').on(t.parentDraftId),
  }),
);

export const contentAssetBindings = pgTable(
  'content_asset_binding',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => contentDrafts.id, { onDelete: 'cascade' }),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
    role: text('role').notNull().default('primary'),
    crop: jsonb('crop_json').notNull().default({}),
    // Per-role metadata (SRT text for subtitles, compose flags) — MP-AR-005.
    meta: jsonb('meta_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    draftRoleUnique: uniqueIndex('content_asset_binding_draft_role_unique').on(
      t.draftId,
      t.role,
    ),
  }),
);

export const contentGenerationRuns = pgTable(
  'content_generation_run',
  {
    id: text('id').primaryKey(),
    ideaId: text('idea_id').references(() => contentIdeas.id, { onDelete: 'set null' }),
    briefId: text('brief_id').references(() => contentBriefs.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    input: jsonb('input_json').notNull().default({}),
    output: jsonb('output_json').notNull().default({}),
    status: text('status').notNull().default('succeeded'),
    costCents: integer('cost_cents').notNull().default(0),
    errorMessage: text('error_message'),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ideaIdx: index('content_generation_run_idea_idx').on(t.ideaId, t.createdAt),
  }),
);

export const contentBrandReviews = pgTable(
  'content_brand_review',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => contentDrafts.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    scoreTotal: integer('score_total').notNull(),
    score: jsonb('score_json').notNull().default({}),
    violations: jsonb('violations_json').notNull().default([]),
    reviewerId: text('reviewerId').references(() => adminUsers.id, { onDelete: 'set null' }),
    reviewType: text('reviewType').notNull().default('auto'),
    rulesVersion: text('rules_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    draftIdx: index('content_brand_review_draft_idx').on(t.draftId, t.createdAt),
  }),
);

export const contentPosts = pgTable(
  'content_post',
  {
    id: text('id').primaryKey(),
    draftId: text('draft_id')
      .notNull()
      .references(() => contentDrafts.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('approved'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    utm: jsonb('utm_json').notNull().default({}),
    approvedBy: text('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    cancelledBy: text('cancelledBy').references(() => adminUsers.id, { onDelete: 'set null' }),
    cancelledAt: timestamp('cancelledAt', { withTimezone: true }),
    cancelReason: text('cancelReason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Un draft = un post (anti double-approve concurrent, migration 0066).
    draftUnique: uniqueIndex('content_post_draft_unique').on(t.draftId),
    statusIdx: index('content_post_status_idx').on(t.status, t.createdAt),
  }),
);

export const contentPostizDeliveries = pgTable(
  'content_postiz_delivery',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id').notNull(),
    postizPostId: text('postiz_post_id'),
    status: text('status').notNull().default('pending'),
    request: jsonb('request_json').notNull().default({}),
    response: jsonb('response_json').notNull().default({}),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index('content_postiz_delivery_post_idx').on(t.postId),
    statusIdx: index('content_postiz_delivery_status_idx').on(t.status, t.createdAt),
  }),
);

export const contentPerformanceSnapshots = pgTable(
  'content_performance_snapshot',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    metrics: jsonb('metrics_json').notNull().default({}),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postCapturedIdx: index('content_performance_post_captured_idx').on(
      t.postId,
      t.capturedAt,
    ),
  }),
);

export const contentLearningNotes = pgTable(
  'content_learning_note',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').references(() => contentPosts.id, { onDelete: 'set null' }),
    note: text('note').notNull(),
    tags: jsonb('tags_json').notNull().default([]),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const contentIdempotencyKeys = pgTable(
  'content_idempotency_key',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    response: jsonb('response_json').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiresIdx: index('content_idempotency_key_expires_idx').on(t.expiresAt),
  }),
);
