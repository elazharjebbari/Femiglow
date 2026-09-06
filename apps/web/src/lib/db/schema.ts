import {
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const leadStatus = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
  'archived',
]);

export const leadEventType = pgEnum('lead_event_type', [
  'created',
  'status_changed',
  'note_added',
  'order_linked',
  'webhook_dispatched',
]);

export const deliveryStatus = pgEnum('delivery_status', [
  'pending',
  'in_progress',
  'succeeded',
  'failed',
  'permanent',
]);

export const adminUsers = pgTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex('admin_users_email_unique').on(t.email),
  }),
);

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name'),
    status: leadStatus('status').notNull().default('new'),
    source: text('source'),
    consentMarketing: boolean('consent_marketing').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index('leads_email_idx').on(t.email),
    statusIdx: index('leads_status_idx').on(t.status),
    createdAtIdx: index('leads_created_at_idx').on(t.createdAt),
  }),
);

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    // CHA-230 — FK optionnelle vers chat_lead pour relier l'order au lead
    // capturé via le wizard. NULL pour les orders legacy.
    chatLeadId: text('chat_lead_id'),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull(),
    shippingMode: text('shipping_mode').notNull(),
    paymentMethod: text('payment_method').notNull(),
    // CHA-230 — Form context (taxonomie tracking, cohérent avec chat_lead)
    formId: text('form_id'),
    formMode: text('form_mode', {
      enum: ['wizard_embed', 'wizard_cart', 'legacy_cart'],
    }),
    variantKey: text('variant_key', { enum: ['A', 'B', 'control'] }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index('orders_lead_idx').on(t.leadId),
    chatLeadIdx: index('orders_chat_lead_idx').on(t.chatLeadId),
    formIdx: index('orders_form_idx').on(t.formId, t.formMode, t.createdAt),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
  }),
);

export const leadEvents = pgTable(
  'lead_events',
  {
    id: text('id').primaryKey(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    type: leadEventType('type').notNull(),
    actorId: text('actor_id'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index('lead_events_lead_idx').on(t.leadId),
    createdAtIdx: index('lead_events_created_at_idx').on(t.createdAt),
  }),
);

// — lead_tag (M5.5) ───────────────────────────────────────────────────────
// Tags attribuables à un lead manuellement ou via automation steps.
// Utilisable comme filtre dans audience builder (has_tag/not_has_tag).
export const leadTag = pgTable(
  'lead_tag',
  {
    // DRIFT FIX (chantier 1.1) — la colonne SQL est `uuid DEFAULT
    // gen_random_uuid()` (prod + migrations). Le schéma déclarait `text`, et le
    // code insérait `createId('tag')` (= `tag_…`, non-uuid) → l'INSERT crashait
    // au cast uuid → PATCH /api/checkout/order/[orderId]/email renvoyait 500.
    // On aligne Drizzle/code sur la DB (référence) : la base génère l'id.
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    source: text('source', { enum: ['manual', 'automation', 'import'] })
      .notNull()
      .default('manual'),
    sourceRef: text('source_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadTagUnique: uniqueIndex('lead_tag_unique').on(t.leadId, t.tag),
    tagIdx: index('idx_lead_tag_tag').on(t.tag),
    leadIdx: index('idx_lead_tag_lead').on(t.leadId),
  }),
);

export type LeadTagRow = typeof leadTag.$inferSelect;
export type LeadTagInsert = typeof leadTag.$inferInsert;

// — user_event (M5.2) ─────────────────────────────────────────────────────
// Source de vérité unifiée des events utilisateur (web/email/server/admin).
// Voir docs/emailing/admin-evolution/01-data/01-tables.md#user_event
export const userEvent = pgTable(
  'user_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: text('email').notNull(),
    eventName: text('event_name').notNull(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    properties: jsonb('properties').notNull().default({}),
    sessionId: text('session_id'),
    source: text('source', { enum: ['web', 'server', 'email', 'admin', 'import'] }).notNull(),
    leadId: text('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Index simple posé dans 0040 (FK constraint). Les heavy indexes
    // (email+ts, event_name+ts, GIN(properties)) sont dans 0041 CONCURRENTLY.
    leadIdx: index('idx_user_event_lead_id').on(t.leadId),
  }),
);

export type UserEventRow = typeof userEvent.$inferSelect;
export type UserEventInsert = typeof userEvent.$inferInsert;
export type UserEventSource = 'web' | 'server' | 'email' | 'admin' | 'import';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  events: jsonb('events').notNull().$type<string[]>().default([]),
  encryptedSecret: text('encrypted_secret').notNull(),
  active: boolean('active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    endpointId: text('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull().default({}),
    idempotencyKey: text('idempotency_key').notNull(),
    status: deliveryStatus('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorCode: text('error_code'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointIdempotency: uniqueIndex('webhook_deliveries_endpoint_idempotency_unique').on(
      t.endpointId,
      t.idempotencyKey,
    ),
    statusIdx: index('webhook_deliveries_status_idx').on(t.status),
    nextAttemptIdx: index('webhook_deliveries_next_attempt_idx').on(t.nextAttemptAt),
  }),
);

// CHA-260 — Outbound webhook log : observabilité + idempotency pour les
// triggers métier (order, chat-lead, cart-abandon, contact, newsletter)
// qui POSTent un payload PLAT vers `OUTBOUND_WEBHOOK_URL`.
// Différence avec `webhook_deliveries` : pas de FK vers un endpoint
// stocké en DB — l'URL/secret viennent de l'env (1 destination unique).
export const outboundWebhookLog = pgTable(
  'outbound_webhook_log',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    eventName: text('event_name').notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: text('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    responseStatus: integer('response_status'),
    latencyMs: integer('latency_ms'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idemIdx: uniqueIndex('outbound_webhook_log_idem_idx').on(t.idempotencyKey),
    sourceIdx: index('outbound_webhook_log_source_idx').on(t.source, t.sourceId),
    statusIdx: index('outbound_webhook_log_status_idx').on(t.status, t.createdAt),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    action: text('action').notNull(),
    actorId: text('actor_id'),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    meta: jsonb('meta').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdAtIdx: index('audit_events_created_at_idx').on(t.createdAt),
    actionIdx: index('audit_events_action_idx').on(t.action),
  }),
);

export const mediaKind = pgEnum('media_kind', ['image', 'video', 'audio']);
export const mediaSource = pgEnum('media_source', ['upload', 'external']);
export const mediaStatus = pgEnum('media_status', [
  'pending',
  'processing',
  'ready',
  'failed',
  'passthrough',
]);
export const mediaQualityProfile = pgEnum('media_quality_profile', [
  'hero',
  'inline',
  'thumb',
]);
export const mediaLoadingStrategy = pgEnum('media_loading_strategy', [
  'eager',
  'viewport',
  'idle',
  'interaction',
]);
export const variantFormat = pgEnum('variant_format', [
  'avif',
  'webp',
  'jpeg',
  'png',
  'mp4',
  'webm',
  'mp3',
  'opus',
  'poster',
]);
export const variantBreakpoint = pgEnum('variant_breakpoint', [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
]);
export const mediaUsageType = pgEnum('media_usage_type', [
  'page',
  'section',
  'og',
  'email',
  'webhook',
]);
export const mediaContext = pgEnum('media_context', [
  'hero',
  'inline',
  'thumb',
  'og',
]);
export const mediaJobKind = pgEnum('media_job_kind', [
  'optimize',
  'regenerate',
  'phash',
  'delete',
]);
export const mediaJobStatus = pgEnum('media_job_status', [
  'pending',
  'in_progress',
  'done',
  'failed',
]);

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    kind: mediaKind('kind').notNull(),
    source: mediaSource('source').notNull(),
    slug: text('slug').notNull(),
    originalUrl: text('original_url'),
    originalFilename: text('original_filename'),
    originalSizeBytes: bigint('original_size_bytes', { mode: 'number' }),
    originalMime: text('original_mime'),
    originalWidth: integer('original_width'),
    originalHeight: integer('original_height'),
    originalDurationMs: integer('original_duration_ms'),
    phash: text('phash'),
    blurhash: text('blurhash'),
    palette: jsonb('palette').notNull().default([]),
    alt: text('alt').notNull(),
    caption: text('caption'),
    credit: text('credit'),
    status: mediaStatus('status').notNull().default('pending'),
    failureReason: text('failure_reason'),
    qualityProfile: mediaQualityProfile('quality_profile').notNull().default('inline'),
    loadingStrategy: mediaLoadingStrategy('loading_strategy').notNull().default('viewport'),
    isHero: boolean('is_hero').notNull().default(false),
    overrides: jsonb('overrides').notNull().default({}),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugUnique: uniqueIndex('media_slug_unique')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    phashIdx: index('media_phash_idx')
      .on(t.phash)
      .where(sql`${t.phash} IS NOT NULL`),
    statusIdx: index('media_status_idx').on(t.status, t.createdAt),
    kindIdx: index('media_kind_idx').on(t.kind, t.deletedAt),
    createdAtIdx: index('media_created_at_idx').on(t.createdAt),
  }),
);

export const mediaVariants = pgTable(
  'media_variants',
  {
    id: text('id').primaryKey(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    format: variantFormat('format').notNull(),
    breakpoint: variantBreakpoint('breakpoint'),
    width: integer('width'),
    height: integer('height'),
    bitrateKbps: integer('bitrate_kbps'),
    quality: integer('quality'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    url: text('url').notNull(),
    checksum: text('checksum').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    mediaIdx: index('variants_media_idx').on(t.mediaId),
    formatBreakpointUnique: uniqueIndex('variants_format_breakpoint_idx')
      .on(t.mediaId, t.format, t.breakpoint)
      .where(sql`${t.breakpoint} IS NOT NULL`),
  }),
);

export const mediaTags = pgTable(
  'media_tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameUnique: uniqueIndex('media_tags_name_unique').on(t.name),
  }),
);

export const mediaToTags = pgTable(
  'media_to_tags',
  {
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => mediaTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.mediaId, t.tagId] }),
  }),
);

export const mediaUsages = pgTable(
  'media_usages',
  {
    id: text('id').primaryKey(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    usageType: mediaUsageType('usage_type').notNull(),
    route: text('route').notNull(),
    component: text('component').notNull(),
    context: mediaContext('context').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    mediaIdx: index('usages_media_idx').on(t.mediaId),
    routeIdx: index('usages_route_idx').on(t.route),
    unique: uniqueIndex('usages_unique').on(t.mediaId, t.route, t.component),
  }),
);

/**
 * Stories vidéo shoppables (façon Instagram) — une story = une bulle cliquable
 * + N segments vidéo. Voir docs/stories-video-2026-08-21/.
 * P1 : URLs directes (assets `public/` self-hosted, Range géré par Next).
 * P2 : `bubbleMediaId`/`mediaId` permettent de brancher la média-library.
 */
export const mediaStory = pgTable(
  'media_story',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    pageGroup: text('page_group').notNull().default('kit'),
    /** Titre localisé { fr, ar, en }. */
    titleI18n: jsonb('title_i18n').notNull().default({}),
    /** Poster de la bulle (image ronde). */
    bubblePosterUrl: text('bubble_poster_url').notNull(),
    /** Optionnel : média-library (P2). */
    bubbleMediaId: text('bubble_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    /** Token d'accent optionnel (anneau de bulle). */
    accent: text('accent'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('media_story_slug_unique').on(t.slug),
    activeOrderIdx: index('media_story_active_order_idx').on(
      t.pageGroup,
      t.isActive,
      t.displayOrder,
    ),
  }),
);

export const mediaStorySegment = pgTable(
  'media_story_segment',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => mediaStory.id, { onDelete: 'cascade' }),
    /** Optionnel : média-library (P2). */
    mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
    /** Source mp4 (self-hosted `public/` ou CDN). */
    videoUrl: text('video_url').notNull(),
    /** Source webm optionnelle (P2). */
    webmUrl: text('webm_url'),
    posterUrl: text('poster_url').notNull(),
    durationMs: integer('duration_ms').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    captionI18n: jsonb('caption_i18n').notNull().default({}),
    ctaLabelI18n: jsonb('cta_label_i18n').notNull().default({}),
    /** Ancre CTA (ex. `#commander-femiglow`). */
    ctaTarget: text('cta_target'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    storyOrderIdx: index('media_story_segment_story_order_idx').on(
      t.storyId,
      t.isActive,
      t.displayOrder,
    ),
  }),
);

export type MediaStoryRow = typeof mediaStory.$inferSelect;
export type MediaStorySegmentRow = typeof mediaStorySegment.$inferSelect;

export const mediaJobs = pgTable(
  'media_jobs',
  {
    id: text('id').primaryKey(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    kind: mediaJobKind('kind').notNull(),
    status: mediaJobStatus('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    errorMessage: text('error_message'),
    payload: jsonb('payload').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusNextIdx: index('jobs_status_next_idx')
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} IN ('pending','in_progress')`),
    mediaIdx: index('jobs_media_idx').on(t.mediaId),
  }),
);

export const trackingComponentCategoryEnum = pgEnum('tracking_component_category', [
  'cta_primary',
  'cta_secondary',
  'cta_ghost',
  'navigation',
  'form_input',
  'form_submit',
  'media_image',
  'media_video',
  'media_audio',
  'list_item',
  'card',
  'pricing',
  'filter',
  'search',
  'social_share',
  'newsletter',
  'modal',
  'accordion',
  'tab',
  'carousel',
  'progress',
  'banner',
  'section_hero',
  'section_promotion',
  'section_video',
  'section_content',
  'section_testimonial',
  'section_faq',
  'commerce_cart',
  'commerce_checkout',
  'engagement',
  'chat',
  'admin',
]);

export const trackingEventScopeEnum = pgEnum('tracking_event_scope', [
  'web',
  'server',
  'both',
]);

export const trackingEventCategoryEnum = pgEnum('tracking_event_category', [
  'page',
  'engagement',
  'ecommerce',
  'lead',
  'media',
  'admin',
  'custom',
]);

// Migration 0009 — funnel stage pour catalogue d'events
export const trackingFunnelStageEnum = pgEnum('tracking_funnel_stage', [
  'tof',
  'mof',
  'bof',
  'conversion',
  'none',
]);

export const trackingProviderKindEnum = pgEnum('tracking_provider_kind', [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
]);

export const trackingProviderStatusEnum = pgEnum('tracking_provider_status', [
  'disabled',
  'enabled',
  'error',
]);

export const trackingConsentStateEnum = pgEnum('tracking_consent_state', [
  'granted',
  'denied',
  'pending',
]);

// Migration 0029 — catégorie Conversion Action Google Ads (default + override).
export const googleAdsCategoryEnum = pgEnum('google_ads_category', [
  'purchase',
  'lead',
  'contact',
  'signup',
  'view_content',
  'none',
]);

export const trackingPages = pgTable(
  'tracking_pages',
  {
    id: text('id').primaryKey(),
    route: text('route').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    routeUnique: uniqueIndex('tracking_pages_route_unique').on(t.route),
    categoryIdx: index('tracking_pages_category_idx').on(t.category),
  }),
);

export const trackingComponents = pgTable(
  'tracking_components',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    category: trackingComponentCategoryEnum('category').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(false),
    defaultParams: jsonb('default_params').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    pathUnique: uniqueIndex('tracking_components_path_unique').on(t.path),
    categoryIdx: index('tracking_components_category_idx').on(t.category),
  }),
);

export const trackingPagesComponents = pgTable(
  'tracking_pages_components',
  {
    pageId: text('page_id')
      .notNull()
      .references(() => trackingPages.id, { onDelete: 'cascade' }),
    componentId: text('component_id')
      .notNull()
      .references(() => trackingComponents.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageId, t.componentId] }),
    pageIdx: index('tracking_pc_page_idx').on(t.pageId),
    compIdx: index('tracking_pc_comp_idx').on(t.componentId),
  }),
);

export const trackingEventDefinitions = pgTable(
  'tracking_event_definitions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: trackingEventCategoryEnum('category').notNull(),
    scope: trackingEventScopeEnum('scope').notNull().default('web'),
    description: text('description').notNull(),
    isConversion: boolean('is_conversion').notNull().default(false),
    paramsSchema: jsonb('params_schema').notNull().default({}),
    applicableCategories: trackingComponentCategoryEnum('applicable_categories')
      .array()
      .notNull()
      .default(sql`ARRAY[]::tracking_component_category[]`),
    defaultProviders: text('default_providers').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Migration 0009 — funnel mapping pour TOF/MOF/BOF/CONVERSION
    funnelStage: trackingFunnelStageEnum('funnel_stage').notNull().default('none'),
    // Migration 0029 — catégorie Google Ads par défaut (override possible via tracking_event_overrides).
    googleAdsCategoryDefault: googleAdsCategoryEnum('google_ads_category_default')
      .notNull()
      .default('none'),
  },
  (t) => ({
    nameUnique: uniqueIndex('tracking_event_def_name_unique').on(t.name),
    categoryIdx: index('tracking_event_def_category_idx').on(t.category),
    funnelStageIdx: index('tracking_event_def_funnel_stage_idx').on(t.funnelStage),
  }),
);

// Migration 0030 — override admin de la catégorie Google Ads par event (D-005).
export const trackingEventOverrides = pgTable(
  'tracking_event_overrides',
  {
    id: text('id').primaryKey(),
    eventName: text('event_name')
      .notNull()
      .references(() => trackingEventDefinitions.name, { onDelete: 'cascade' }),
    googleAdsCategory: googleAdsCategoryEnum('google_ads_category').notNull(),
    updatedBy: text('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    note: text('note'),
  },
  (t) => ({
    eventNameUnique: uniqueIndex('tracking_event_overrides_event_name_unique').on(t.eventName),
    eventNameIdx: index('tracking_event_overrides_event_name_idx').on(t.eventName),
  }),
);

// Migration 0032 — Event mappings : versionning event_canonique → vendor.
// cf. docs/event-mappings/10-architecture/adr-001-versioning-strategy.md
export const eventMappingVersions = pgTable(
  'event_mapping_versions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    notes: text('notes'),
    status: text('status').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    mappings: jsonb('mappings').notNull().default({}),
    clonedFrom: text('cloned_from'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    oneActiveIdx: uniqueIndex('event_mapping_versions_one_active')
      .on(t.isActive)
      .where(sql`is_active = true`),
    statusIdx: index('event_mapping_versions_status_idx').on(t.status, t.createdAt),
    defaultIdx: uniqueIndex('event_mapping_versions_default_idx')
      .on(t.isDefault)
      .where(sql`is_default = true`),
    mappingsGin: index('event_mapping_versions_mappings_gin').using(
      'gin',
      t.mappings,
    ),
  }),
);

// Migration 0033 — audit log structuré.
export const eventMappingAudit = pgTable(
  'event_mapping_audit',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id'),
    action: text('action').notNull(),
    actorId: text('actor_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    meta: jsonb('meta').notNull().default({}),
    ipAnonymized: text('ip_anonymized'),
    uaHash: text('ua_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    versionIdx: index('event_mapping_audit_version_idx').on(t.versionId, t.createdAt),
    actorIdx: index('event_mapping_audit_actor_idx').on(t.actorId, t.createdAt),
    actionIdx: index('event_mapping_audit_action_idx').on(t.action, t.createdAt),
  }),
);

export const trackingComponentEvents = pgTable(
  'tracking_component_events',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => trackingComponents.id, { onDelete: 'cascade' }),
    eventDefinitionId: text('event_definition_id')
      .notNull()
      .references(() => trackingEventDefinitions.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    paramsOverride: jsonb('params_override').$type<Record<string, unknown>>().notNull().default({}),
    providersOverride: text('providers_override').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('tracking_ce_unique').on(t.componentId, t.eventDefinitionId),
    compIdx: index('tracking_ce_comp_idx').on(t.componentId),
  }),
);

export const trackingProviders = pgTable(
  'tracking_providers',
  {
    id: text('id').primaryKey(),
    kind: trackingProviderKindEnum('kind').notNull(),
    status: trackingProviderStatusEnum('status').notNull().default('disabled'),
    pixelId: text('pixel_id'),
    capiToken: text('capi_token'),
    capiTokenIv: text('capi_token_iv'),
    capiTokenTag: text('capi_token_tag'),
    testEventCode: text('test_event_code'),
    customHead: text('custom_head'),
    customBody: text('custom_body'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    enabledEvents: text('enabled_events').array().notNull().default(sql`ARRAY[]::text[]`),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    errorCount24h: integer('error_count_24h').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kindUnique: uniqueIndex('tracking_providers_kind_unique').on(t.kind),
  }),
);

export const trackingEventsLog = pgTable(
  'tracking_events_log',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').notNull(),
    eventCategory: trackingEventCategoryEnum('event_category').notNull(),
    pageId: text('page_id').references(() => trackingPages.id, { onDelete: 'set null' }),
    componentId: text('component_id').references(() => trackingComponents.id, {
      onDelete: 'set null',
    }),
    pageRoute: text('page_route').notNull(),
    anonymousId: text('anonymous_id').notNull(),
    sessionId: text('session_id').notNull(),
    userId: text('user_id'),
    consentSnapshot: jsonb('consent_snapshot').notNull(),
    payload: jsonb('payload').notNull(),
    uaHash: text('ua_hash').notNull(),
    ipAnonymized: text('ip_anonymized').notNull(),
    device: text('device').notNull(),
    locale: text('locale').notNull(),
    isConversion: boolean('is_conversion').notNull().default(false),
    providersDispatched: text('providers_dispatched').array().notNull().default(sql`ARRAY[]::text[]`),
    providersResults: jsonb('providers_results').notNull().default({}),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    schemaVersion: integer('schema_version').notNull().default(1),
    // Migration 0009 — colonnes attribution & A/B
    trafficSource: text('traffic_source'),
    trafficMedium: text('traffic_medium'),
    experimentId: text('experiment_id'),
    experimentVariant: text('experiment_variant'),
    // Migration 0028 — Google click ID capturé en middleware (cookie first-touch).
    gclid: text('gclid'),
  },
  (t) => ({
    eventIdUnique: uniqueIndex('tracking_events_log_event_id_unique').on(t.eventId),
    nameIdx: index('tracking_events_log_name_idx').on(t.eventName),
    receivedAtIdx: index('tracking_events_log_received_at_idx').on(t.receivedAt),
    anonymousIdx: index('tracking_events_log_anonymous_idx').on(t.anonymousId),
    sessionIdx: index('tracking_events_log_session_idx').on(t.sessionId),
    conversionIdx: index('tracking_events_log_conversion_idx')
      .on(t.isConversion)
      .where(sql`is_conversion = true`),
    trafficSourceIdx: index('tracking_events_log_traffic_source_idx').on(t.trafficSource),
    experimentIdx: index('tracking_events_log_experiment_idx')
      .on(t.experimentId)
      .where(sql`experiment_id IS NOT NULL`),
    receivedSessionIdx: index('tracking_events_log_received_session_idx').on(
      t.receivedAt,
      t.sessionId,
    ),
    nameReceivedIdx: index('tracking_events_log_name_received_idx').on(t.eventName, t.receivedAt),
    gclidIdx: index('tracking_events_log_gclid_idx')
      .on(t.gclid)
      .where(sql`gclid IS NOT NULL`),
  }),
);

export const trackingConsentSnapshots = pgTable(
  'tracking_consent_snapshots',
  {
    id: text('id').primaryKey(),
    anonymousId: text('anonymous_id').notNull(),
    state: jsonb('state').notNull(),
    stateHash: text('state_hash').notNull(),
    source: text('source').notNull(),
    ipAnonymized: text('ip_anonymized').notNull(),
    uaHash: text('ua_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    anonymousIdx: index('tracking_consent_anonymous_idx').on(t.anonymousId),
    uniq: uniqueIndex('tracking_consent_anonymous_state_unique').on(t.anonymousId, t.stateHash),
  }),
);

/**
 * Réglages tracking (KV simple) — utilisé pour les flags globaux comme
 * l'activation du bandeau de consentement (désactivable dans certains
 * pays comme le Maroc ou les US où il n'est pas obligatoire).
 */
export const trackingSettings = pgTable(
  'tracking_settings',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    keyUnique: uniqueIndex('tracking_settings_key_unique').on(t.key),
  }),
);

/**
 * Snapshot d'attribution multi-canal par visitor_id. Cf.
 * docs/tracking-attribution/. Sert :
 *   - de source de vérité cross-session (le cookie est limité à 4KB)
 *   - de support au debugger admin (inspecter un visitor par ID)
 *   - de pré-requis pour les dispatchers serveur (Meta CAPI, Google Ads OCI…)
 *
 * `first_touch` est immuable après le 1er insert. `last_touch` est
 * refresh à chaque touche. `paid_history` est LRU 20 (dedup click_id).
 */
export const visitorAttribution = pgTable(
  'visitor_attribution',
  {
    visitorId: text('visitor_id').primaryKey(),
    firstTouch: jsonb('first_touch').notNull(),
    lastTouch: jsonb('last_touch').notNull(),
    paidHistory: jsonb('paid_history').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    updatedIdx: index('visitor_attribution_updated_at_idx').on(t.updatedAt),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * COMPONENT-MEDIA SYSTEM
 * Lie chaque composant visuel du site (registre `siteComponents`) à
 * un ou plusieurs médias via `componentMediaBindings`. Les profils
 * d'animation sont catalogués dans `componentAnimations`. SVG fallback
 * géré côté code via `defaultSvgFallback` + composant `<ComponentMedia>`.
 * ───────────────────────────────────────────────────────────────────── */

export const componentCategoryEnum = pgEnum('component_category', [
  'hero',
  'section',
  'card',
  'gallery',
  'carousel',
  'banner',
  'form',
  'media-block',
  'cta',
]);

export const animationKindEnum = pgEnum('animation_kind', [
  'none',
  'framer-motion',
  'css',
  'svg',
]);

export const placeholderStrategyEnum = pgEnum('placeholder_strategy', [
  'svg',
  'blurhash',
  'palette',
  'none',
]);

export const mediaObjectFitEnum = pgEnum('media_object_fit', [
  'cover',
  'contain',
  'fill',
  'none',
  'scale-down',
]);

export const mediaObjectPositionEnum = pgEnum('media_object_position', [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
]);

export const fetchPriorityEnum = pgEnum('fetch_priority', [
  'high',
  'low',
  'auto',
]);

export const siteComponents = pgTable(
  'site_components',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: componentCategoryEnum('category').notNull(),
    pageGroup: text('page_group').notNull(),
    filePath: text('file_path'),
    slots: jsonb('slots').notNull().default([]),
    /**
     * Champs éditoriaux du composant (Components-CMS).
     * Source de vérité = registre TS, synchronisé par seed-pipeline.
     * cf. docs/components-cms/architecture/02-data-model.md
     */
    fields: jsonb('fields').notNull().default([]),
    defaultSvgFallback: text('default_svg_fallback'),
    defaultLoadingStrategy: mediaLoadingStrategy('default_loading_strategy')
      .notNull()
      .default('viewport'),
    defaultFetchPriority: fetchPriorityEnum('default_fetch_priority')
      .notNull()
      .default('auto'),
    supportsAnimation: boolean('supports_animation').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUnique: uniqueIndex('site_components_key_unique').on(t.key),
    pageGroupIdx: index('site_components_page_group_idx').on(t.pageGroup),
    categoryIdx: index('site_components_category_idx').on(t.category),
  }),
);

export const componentMediaBindings = pgTable(
  'component_media_bindings',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => siteComponents.id, { onDelete: 'cascade' }),
    slot: text('slot').notNull(),
    mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
    loadingStrategy: mediaLoadingStrategy('loading_strategy')
      .notNull()
      .default('viewport'),
    fetchPriority: fetchPriorityEnum('fetch_priority').notNull().default('auto'),
    priority: boolean('priority').notNull().default(false),
    placeholderStrategy: placeholderStrategyEnum('placeholder_strategy')
      .notNull()
      .default('svg'),
    customAlt: text('custom_alt'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(false),
    notes: text('notes'),
    objectFit: mediaObjectFitEnum('object_fit').notNull().default('cover'),
    objectPosition: mediaObjectPositionEnum('object_position').notNull().default('center'),
    focalX: integer('focal_x'),
    focalY: integer('focal_y'),
    /** Backdrop coloré derrière l'image (utile en `contain`). NULL = palette. */
    backgroundFill: text('background_fill'),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    componentSlotUnique: uniqueIndex('component_media_bindings_component_slot_unique').on(
      t.componentId,
      t.slot,
    ),
    mediaIdx: index('component_media_bindings_media_idx').on(t.mediaId),
    activeIdx: index('component_media_bindings_active_idx').on(t.componentId, t.isActive),
  }),
);

export const componentAnimations = pgTable(
  'component_animations',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    kind: animationKindEnum('kind').notNull(),
    description: text('description'),
    config: jsonb('config').notNull().default({}),
    respectsReducedMotion: boolean('respects_reduced_motion').notNull().default(true),
    previewSnippet: text('preview_snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyUnique: uniqueIndex('component_animations_key_unique').on(t.key),
  }),
);

export const componentAnimationBindings = pgTable(
  'component_animation_bindings',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => siteComponents.id, { onDelete: 'cascade' }),
    animationId: text('animation_id')
      .notNull()
      .references(() => componentAnimations.id, { onDelete: 'cascade' }),
    isDefault: boolean('is_default').notNull().default(false),
    params: jsonb('params').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    componentAnimUnique: uniqueIndex('component_animation_bindings_unique').on(
      t.componentId,
      t.animationId,
    ),
    componentIdx: index('component_animation_bindings_component_idx').on(t.componentId),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * COMPONENTS-CMS — champs éditoriaux typés
 * cf. docs/components-cms/architecture/02-data-model.md
 * ───────────────────────────────────────────────────────────────────── */

export const fieldBindingStatusEnum = pgEnum('field_binding_status', [
  'draft',
  'published',
  'scheduled',
  'archived',
]);

export const fieldHistoryActionEnum = pgEnum('field_history_action', [
  'create',
  'update',
  'publish',
  'unpublish',
  'restore',
  'archive',
  'schedule',
  'unschedule',
]);

export const componentFieldBindings = pgTable(
  'component_field_bindings',
  {
    id: text('id').primaryKey(),
    componentId: text('component_id')
      .notNull()
      .references(() => siteComponents.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').notNull(),
    locale: text('locale').notNull().default('fr'),
    value: jsonb('value').notNull(),
    status: fieldBindingStatusEnum('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    notes: text('notes'),
    authorId: text('author_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    publishedUnique: uniqueIndex('cfb_publish_uniq')
      .on(t.componentId, t.fieldKey, t.locale)
      .where(sql`${t.status} = 'published'`),
    draftUnique: uniqueIndex('cfb_draft_uniq')
      .on(t.componentId, t.fieldKey, t.locale)
      .where(sql`${t.status} = 'draft'`),
    lookupIdx: index('cfb_lookup').on(t.componentId, t.fieldKey, t.locale, t.status),
    scheduledIdx: index('cfb_scheduled')
      .on(t.status, t.scheduledAt)
      .where(sql`${t.status} = 'scheduled'`),
  }),
);

export const componentFieldHistory = pgTable(
  'component_field_history',
  {
    id: text('id').primaryKey(),
    bindingId: text('binding_id')
      .notNull()
      .references(() => componentFieldBindings.id, { onDelete: 'cascade' }),
    componentId: text('component_id').notNull(),
    fieldKey: text('field_key').notNull(),
    locale: text('locale').notNull(),
    version: integer('version').notNull(),
    value: jsonb('value').notNull(),
    status: fieldBindingStatusEnum('status').notNull(),
    actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    action: fieldHistoryActionEnum('action').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bindingIdx: index('cfh_binding_idx').on(t.bindingId, t.createdAt),
    triplet: index('cfh_triplet').on(t.componentId, t.fieldKey, t.locale, t.createdAt),
    createdAtIdx: index('cfh_created_at_idx').on(t.createdAt),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * ADMIN-CONFIG — configuration centralisée (NAV, flags, RBAC, branding)
 * cf. docs/admin-config/architecture/02-data-model.md
 * ───────────────────────────────────────────────────────────────────── */

export const appConfig = pgTable('app_config', {
  section: text('section').primaryKey(),
  payload: jsonb('payload').notNull().default({}),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

export const appConfigSnapshots = pgTable(
  'app_config_snapshots',
  {
    id: text('id').primaryKey(),
    section: text('section').notNull(),
    payload: jsonb('payload').notNull(),
    version: integer('version').notNull(),
    actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    note: text('note'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sectionCapturedIdx: index('acs_section_captured_idx').on(t.section, t.capturedAt),
    actorIdx: index('acs_actor_idx').on(t.actorId),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * SEO-CMS — overrides, settings, audit snapshots
 * cf. docs/seo-cms/architecture/02-data-model.md
 * ───────────────────────────────────────────────────────────────────── */

export const seoScopeEnum = pgEnum('seo_scope', ['page', 'component', 'product', 'article']);

export const ogImageTemplateEnum = pgEnum('og_image_template', [
  'marketing',
  'article',
  'product',
  'default',
]);

export const twitterCardTypeEnum = pgEnum('twitter_card_type', [
  'summary',
  'summary_large_image',
]);

export const seoOverrides = pgTable(
  'seo_overrides',
  {
    id: text('id').primaryKey(),
    scope: seoScopeEnum('scope').notNull(),
    targetKey: text('target_key').notNull(),
    locale: text('locale').notNull().default('fr-MA'),
    title: text('title'),
    description: text('description'),
    keywords: jsonb('keywords').notNull().default([]),
    ogTitle: text('og_title'),
    ogDescription: text('og_description'),
    ogImageMediaId: text('og_image_media_id').references(() => media.id, {
      onDelete: 'set null',
    }),
    ogImageTemplate: ogImageTemplateEnum('og_image_template'),
    twitterCard: twitterCardTypeEnum('twitter_card').notNull().default('summary_large_image'),
    canonical: text('canonical'),
    robotsIndex: boolean('robots_index').notNull().default(true),
    robotsFollow: boolean('robots_follow').notNull().default(true),
    structuredData: jsonb('structured_data'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    draftedAt: timestamp('drafted_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  },
  (t) => ({
    targetUnique: uniqueIndex('seo_overrides_target_unique').on(t.scope, t.targetKey, t.locale),
    publishedIdx: index('seo_overrides_published_idx').on(t.publishedAt),
    scopeIdx: index('seo_overrides_scope_idx').on(t.scope),
  }),
);

export const seoSettings = pgTable('seo_settings', {
  id: text('id').primaryKey(),
  siteName: text('site_name').notNull().default('FemiGlow'),
  defaultDescription: text('default_description'),
  defaultOgImageMediaId: text('default_og_image_media_id').references(() => media.id, {
    onDelete: 'set null',
  }),
  twitterHandle: text('twitter_handle'),
  organizationJsonLd: jsonb('organization_json_ld'),
  defaultRobotsIndex: boolean('default_robots_index').notNull().default(true),
  defaultRobotsFollow: boolean('default_robots_follow').notNull().default(true),
  knownPages: jsonb('known_pages').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

export const seoAuditSnapshots = pgTable(
  'seo_audit_snapshots',
  {
    id: text('id').primaryKey(),
    scope: seoScopeEnum('scope').notNull(),
    targetKey: text('target_key').notNull(),
    locale: text('locale').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').notNull(),
    actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  },
  (t) => ({
    targetIdx: index('seo_audit_snapshots_target_idx').on(
      t.scope,
      t.targetKey,
      t.locale,
      t.capturedAt,
    ),
  }),
);

// -- products-cms --------------------------------------------------------
export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'published',
  'archived',
]);

export const inventoryStatusEnum = pgEnum('inventory_status', [
  'available',
  'low_stock',
  'out_of_stock',
  'preorder',
]);

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    status: productStatusEnum('status').notNull().default('draft'),
    title: text('title').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    category: text('category'),
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    position: integer('position').notNull().default(0),
    featured: boolean('featured').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    slugUnique: uniqueIndex('products_slug_unique').on(t.slug),
    statusPubIdx: index('products_status_published_at_idx').on(t.status, t.publishedAt),
    categoryIdx: index('products_category_idx').on(t.category),
  }),
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    label: text('label').notNull(),
    priceCents: integer('price_cents').notNull(),
    promoPriceCents: integer('promo_price_cents'),
    currency: text('currency').notNull().default('EUR'),
    inventoryStatus: inventoryStatusEnum('inventory_status').notNull().default('available'),
    weightG: integer('weight_g'),
    attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productSkuUnique: uniqueIndex('product_variants_product_sku_idx').on(
      t.productId,
      t.sku,
    ),
    productPositionIdx: index('product_variants_product_position_idx').on(
      t.productId,
      t.position,
    ),
  }),
);

export const productSnapshots = pgTable(
  'product_snapshots',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').notNull(),
    actorId: text('actor_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    note: text('note'),
  },
  (t) => ({
    productCapturedIdx: index('product_snapshots_product_captured_idx').on(
      t.productId,
      t.capturedAt,
    ),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * A/B TESTING (migration 0011)
 * Tables vides en V1 ; alimentées par UI dédiée en V2.
 * cf. docs/analytics/02-data-model.md §5
 * ───────────────────────────────────────────────────────────────────── */

export const experimentStatusEnum = pgEnum('experiment_status', [
  'draft',
  'running',
  'paused',
  'completed',
  'archived',
]);

export const experiments = pgTable(
  'experiments',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    hypothesis: text('hypothesis'),
    status: experimentStatusEnum('status').notNull().default('draft'),
    primaryMetric: text('primary_metric').notNull(),
    secondaryMetrics: jsonb('secondary_metrics').notNull().default(sql`'[]'::jsonb`),
    audienceFilter: jsonb('audience_filter').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  },
  (t) => ({
    nameUnique: uniqueIndex('experiments_name_unique').on(t.name),
    statusIdx: index('experiments_status_idx').on(t.status),
  }),
);

export const experimentVariants = pgTable(
  'experiment_variants',
  {
    id: text('id').primaryKey(),
    experimentId: text('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    isControl: boolean('is_control').notNull().default(false),
    weight: integer('weight').notNull().default(50),
    config: jsonb('config').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    expKeyUnique: uniqueIndex('experiment_variants_exp_key_idx').on(t.experimentId, t.key),
  }),
);

export const experimentAssignments = pgTable(
  'experiment_assignments',
  {
    id: text('id').primaryKey(),
    experimentId: text('experiment_id')
      .notNull()
      .references(() => experiments.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => experimentVariants.id, { onDelete: 'cascade' }),
    anonymousId: text('anonymous_id').notNull(),
    userId: text('user_id'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    context: jsonb('context').notNull().default({}),
  },
  (t) => ({
    expAnonUnique: uniqueIndex('experiment_assignments_exp_anon_idx').on(
      t.experimentId,
      t.anonymousId,
    ),
    variantIdx: index('experiment_assignments_variant_idx').on(t.variantId),
  }),
);

/* ─────────────────────────────────────────────────────────────────────
 * ANALYTICS INSIGHTS — agrégations pré-calculées + orchestration
 * cf. docs/analytics-insights/02-data.md
 *
 * Six tables :
 *  - insights_event_daily       : event × jour × env × device × locale
 *  - insights_page_daily        : page_route × jour
 *  - insights_component_daily   : component × event × jour
 *  - insights_section_daily     : section × page × jour (avec dwell)
 *  - insights_funnel_daily      : 1 ligne par jour (funnel ecommerce)
 *  - insights_refresh_run       : historique des runs (lock + audit)
 *
 * Toutes les agrégations sont incrémentales (`INSERT … ON CONFLICT DO UPDATE`)
 * et anonymisées par construction. Aucune PII n'est stockée.
 * ───────────────────────────────────────────────────────────────────── */

export const insightsEventDaily = pgTable(
  'insights_event_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // YYYY-MM-DD UTC
    eventName: text('event_name').notNull(),
    eventCategory: text('event_category').notNull(),
    env: text('env').notNull(),
    device: text('device').notNull(),
    locale: text('locale').notNull(),
    count: integer('count').notNull(),
    uniqueSessions: integer('unique_sessions').notNull(),
    conversionCount: integer('conversion_count').notNull().default(0),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ievUnique: uniqueIndex('iev_unique').on(
      t.date,
      t.eventName,
      t.env,
      t.device,
      t.locale,
    ),
    ievDateIdx: index('iev_date_idx').on(t.date),
    ievEventIdx: index('iev_event_idx').on(t.eventName, t.date),
    ievCategoryIdx: index('iev_category_idx').on(t.eventCategory, t.date),
    ievEnvIdx: index('iev_env_idx').on(t.env, t.date),
  }),
);

export const insightsPageDaily = pgTable(
  'insights_page_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    pageRoute: text('page_route').notNull(),
    pageViews: integer('page_views').notNull().default(0),
    uniqueSessions: integer('unique_sessions').notNull().default(0),
    uniqueVisitors: integer('unique_visitors').notNull().default(0),
    eventsTotal: integer('events_total').notNull().default(0),
    scroll75Count: integer('scroll_75_count').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    bounceCount: integer('bounce_count').notNull().default(0),
    avgTimeSeconds: integer('avg_time_seconds').notNull().default(0),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ipaUnique: uniqueIndex('ipa_unique').on(t.date, t.pageRoute),
    ipaDateIdx: index('ipa_date_idx').on(t.date),
    ipaRouteIdx: index('ipa_route_idx').on(t.pageRoute, t.date),
    ipaPvIdx: index('ipa_pv_idx').on(t.pageViews, t.date),
  }),
);

export const insightsComponentDaily = pgTable(
  'insights_component_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    componentId: text('component_id').notNull(),
    componentName: text('component_name'),
    pageRoute: text('page_route'),
    eventName: text('event_name').notNull(),
    count: integer('count').notNull().default(0),
    uniqueSessions: integer('unique_sessions').notNull().default(0),
    conversionCount: integer('conversion_count').notNull().default(0),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    icoUnique: uniqueIndex('ico_unique').on(
      t.date,
      t.componentId,
      t.eventName,
      t.pageRoute,
    ),
    icoDateIdx: index('ico_date_idx').on(t.date),
    icoComponentIdx: index('ico_component_idx').on(t.componentId, t.date),
    icoEventIdx: index('ico_event_idx').on(t.eventName, t.date),
    icoCountIdx: index('ico_count_idx').on(t.count, t.date),
  }),
);

export const insightsSectionDaily = pgTable(
  'insights_section_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    pageRoute: text('page_route').notNull(),
    sectionId: text('section_id').notNull(),
    views: integer('views').notNull().default(0),
    avgDwellSeconds: integer('avg_dwell_seconds').notNull().default(0),
    uniqueSessions: integer('unique_sessions').notNull().default(0),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    iseUnique: uniqueIndex('ise_unique').on(t.date, t.pageRoute, t.sectionId),
    iseDateIdx: index('ise_date_idx').on(t.date),
    iseRouteIdx: index('ise_route_idx').on(t.pageRoute, t.date),
    iseDwellIdx: index('ise_dwell_idx').on(t.avgDwellSeconds, t.date),
  }),
);

export const insightsFunnelDaily = pgTable(
  'insights_funnel_daily',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    viewItem: integer('view_item').notNull().default(0),
    addToCart: integer('add_to_cart').notNull().default(0),
    beginCheckout: integer('begin_checkout').notNull().default(0),
    addPaymentInfo: integer('add_payment_info').notNull().default(0),
    purchase: integer('purchase').notNull().default(0),
    generateLead: integer('generate_lead').notNull().default(0),
    uniquePurchasers: integer('unique_purchasers').notNull().default(0),
    revenueTotalCents: bigint('revenue_total_cents', { mode: 'number' }).notNull().default(0),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ifuUnique: uniqueIndex('ifu_date_unique').on(t.date),
    ifuDateIdx: index('ifu_date_idx').on(t.date),
  }),
);

export const insightsRefreshRun = pgTable(
  'insights_refresh_run',
  {
    id: text('id').primaryKey(),
    trigger: text('trigger').notNull(), // 'cron' | 'manual'
    status: text('status').notNull(), // 'running' | 'success' | 'failed' | 'skipped'
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationsMs: jsonb('durations_ms').notNull().default({}),
    counts: jsonb('counts').notNull().default({}),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    triggeredBy: text('triggered_by'),
  },
  (t) => ({
    irfStartedIdx: index('irf_started_idx').on(t.startedAt),
    irfStatusIdx: index('irf_status_idx').on(t.status, t.startedAt),
  }),
);

// ===========================================================================
// Rituels partagés — cf. docs/reviews-wall/execution/01-architecture-detaillee.md
// ===========================================================================

export const ritualSignal = pgEnum('ritual_signal', ['oui', 'hesite', 'non']);

export const ritualStatus = pgEnum('ritual_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'HIDDEN',
]);

export const ritualSource = pgEnum('ritual_source', [
  'web',
  'email_j45',
  'manual',
  'import_csv',
  'import_json',
  'import_zip',
]);

export const ritualLanguage = pgEnum('ritual_language', ['fr', 'ar', 'en']);

export const ritualPhotoFacesStatus = pgEnum('ritual_photo_faces_status', [
  'PENDING_CHECK',
  'OK',
  'MANUAL_REVIEW',
  'REJECTED_FACE',
]);

export const ritualTestimonials = pgTable(
  'ritual_testimonials',
  {
    id: text('id').primaryKey(),
    publicSlug: text('public_slug').notNull(),
    productKey: text('product_key').notNull(),
    body: text('body').notNull(),
    bodyOriginal: text('body_original'),
    wouldRecommend: ritualSignal('would_recommend').notNull(),
    ritualTags: jsonb('ritual_tags').$type<string[]>().notNull().default([]),
    authorFirstName: text('author_first_name'),
    authorCity: text('author_city'),
    initiatedSince: text('initiated_since'),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    language: ritualLanguage('language').notNull().default('fr'),
    status: ritualStatus('status').notNull().default('PENDING'),
    source: ritualSource('source').notNull(),
    customerHash: text('customer_hash'),
    orderId: text('order_id'),
    verifiedPurchase: boolean('verified_purchase').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    moderationNote: text('moderation_note'),
    autoFlags: jsonb('auto_flags').$type<string[]>().notNull().default([]),
    importBatchId: text('import_batch_id'),
    importRowId: text('import_row_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rtPublicSlugUnique: uniqueIndex('rt_public_slug_unique').on(t.publicSlug),
    rtStatusProductIdx: index('rt_status_product_idx').on(t.status, t.productKey),
    rtPublishedAtIdx: index('rt_published_at_idx').on(t.publishedAt),
    rtCustomerHashIdx: index('rt_customer_hash_idx').on(t.customerHash),
  }),
);

export const ritualTestimonialPhotos = pgTable(
  'ritual_testimonial_photos',
  {
    id: text('id').primaryKey(),
    testimonialId: text('testimonial_id').notNull(),
    url: text('url').notNull(),
    thumbUrl: text('thumb_url').notNull(),
    focalX: text('focal_x').notNull().default('0.500'),
    focalY: text('focal_y').notNull().default('0.500'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: integer('byte_size').notNull(),
    mime: text('mime').notNull(),
    alt: text('alt'),
    facesStatus: ritualPhotoFacesStatus('faces_status').notNull().default('PENDING_CHECK'),
    facesCount: integer('faces_count').notNull().default(0),
    facesCheckAt: timestamp('faces_check_at', { withTimezone: true }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rtpTestimonialIdx: index('rtp_testimonial_idx').on(t.testimonialId, t.position),
    rtpFacesPendingIdx: index('rtp_faces_pending_idx').on(t.facesStatus),
  }),
);

export const ritualAuditLog = pgTable(
  'ritual_audit_log',
  {
    id: text('id').primaryKey(),
    testimonialId: text('testimonial_id'),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    note: text('note'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    previousHash: text('previous_hash'),
    signature: text('signature'),
  },
  (t) => ({
    ralTestimonialIdx: index('ral_testimonial_idx').on(t.testimonialId, t.createdAt),
    ralActorIdx: index('ral_actor_idx').on(t.actorId, t.createdAt),
  }),
);

export const ritualAggregate = pgTable('ritual_aggregate', {
  productKey: text('product_key').primaryKey(),
  totalCount: integer('total_count').notNull().default(0),
  ouiCount: integer('oui_count').notNull().default(0),
  hesiteCount: integer('hesite_count').notNull().default(0),
  nonCount: integer('non_count').notNull().default(0),
  withPhotosCount: integer('with_photos_count').notNull().default(0),
  topTags: jsonb('top_tags').$type<Array<{ tag: string; count: number }>>().notNull().default([]),
  lastPublishedAt: timestamp('last_published_at', { withTimezone: true }),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
});

// ===========================================================================
// CHA-230 — Wizard checkout funnel
// ---------------------------------------------------------------------------
// 4 tables transverses au tunnel :
//   - form_config             — config versionnée par formulaire (wizard_kit, …)
//   - form_config_history     — audit log de chaque mise à jour
//   - product_stock           — stock par variant (SKU) avec available/reserved
//   - form_variant_assignment — stickiness A/B (visitor_id, form_id)
//   - checkout_idempotency    — clés d'idempotence des appels API (TTL 24h)
//
// Cf. docs/checkout-funnel/08-architecture-data.md §3.2–3.5.
// ===========================================================================

export const formConfig = pgTable(
  'form_config',
  {
    id: text('id').primaryKey(),
    /** Clé stable du formulaire (`wizard_kit`, `wizard_commander`, …). UNIQUE. */
    key: text('key').notNull(),
    version: integer('version').notNull().default(1),
    active: boolean('active').notNull().default(true),
    /**
     * JSONB validé côté code (cf. `apps/web/src/lib/checkout/form-config/schema.ts`).
     * Contient : steps[], modes[], defaults, copy, validation.
     */
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    keyUnique: uniqueIndex('form_config_key_unique').on(t.key),
    activeIdx: index('form_config_active_idx').on(t.active, t.updatedAt),
  }),
);

export const formConfigHistory = pgTable(
  'form_config_history',
  {
    id: text('id').primaryKey(),
    formConfigId: text('form_config_id')
      .notNull()
      .references(() => formConfig.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    version: integer('version').notNull(),
    config: jsonb('config').notNull(),
    description: text('description'),
    actorId: text('actor_id'),
    action: text('action', {
      enum: ['create', 'update', 'activate', 'deactivate', 'rollback'],
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    formIdx: index('form_config_history_form_idx').on(t.formConfigId, t.version),
    versionUnique: uniqueIndex('form_config_history_version_unique').on(
      t.formConfigId,
      t.version,
    ),
  }),
);

export const productStock = pgTable(
  'product_stock',
  {
    /** PK = product_variants.id (1-1 avec un variant). */
    variantId: text('variant_id')
      .primaryKey()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    /** Stock physique disponible. >= 0 (CHECK SQL). */
    available: integer('available').notNull().default(0),
    /** Stock réservé par orders in-flight. >= 0. */
    reserved: integer('reserved').notNull().default(0),
    /** Seuil "derniers exemplaires" affiché côté UI. */
    thresholdLow: integer('threshold_low').notNull().default(5),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    skuUnique: uniqueIndex('product_stock_sku_unique').on(t.sku),
    availableIdx: index('product_stock_available_idx').on(t.available, t.reserved),
  }),
);

export const formVariantAssignment = pgTable(
  'form_variant_assignment',
  {
    visitorId: text('visitor_id').notNull(),
    formId: text('form_id').notNull(),
    variantKey: text('variant_key', { enum: ['A', 'B', 'control'] }).notNull(),
    experimentKey: text('experiment_key'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.visitorId, t.formId] }),
    formVariantIdx: index('form_variant_assignment_form_variant_idx').on(
      t.formId,
      t.variantKey,
      t.assignedAt,
    ),
  }),
);

export const checkoutIdempotency = pgTable(
  'checkout_idempotency',
  {
    /** Clé opaque générée client (UUID / ulid). */
    key: text('key').notNull(),
    /** Opération concernée — borne la portée d'idempotence. */
    scope: text('scope', {
      enum: [
        'lead_create',
        'address_update',
        'payment_select',
        'order_create',
        'email_optin',
      ],
    }).notNull(),
    /** ID de la ressource créée (chat_lead.id ou orders.id). */
    resourceId: text('resource_id'),
    /** SHA256 du payload de requête — détecte les changements entre 2 tentatives. */
    requestHash: text('request_hash').notNull(),
    /** Payload exact de la réponse à re-servir (replay). */
    responseJson: jsonb('response_json').notNull(),
    responseStatus: integer('response_status').notNull().default(200),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() + interval '24 hours')`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.key, t.scope] }),
    expiresIdx: index('checkout_idempotency_expires_idx').on(t.expiresAt),
  }),
);

// ===========================================================================
// DELIV-CITIES — Catalogue de villes de livraison (migration 0023)
// ---------------------------------------------------------------------------
// Source initiale = fixture sendit (429 villes uniques après dedup par slug
// en gardant le pk le plus petit). Sert l'autocomplete UI, la tarification
// par ville (MAD), l'affichage du délai (`delivery_eta`) et l'admin CRUD.
//
// Règles clés :
//   - `delivery_price_mad` est en MAD entier (PAS centimes — règle produit).
//   - `slug` est la clé métier stable (ASCII).
//   - `source` indique la provenance (sendit | manual | custom) pour éviter
//     d'écraser une édition admin lors d'une réimportation.
// ===========================================================================

export const deliveryCities = pgTable(
  'delivery_cities',
  {
    id: text('id').primaryKey(),
    /** Slug ASCII stable (slugify du nom FR). UNIQUE — clé métier. */
    slug: text('slug').notNull(),
    /** Libellé Latin/FR (affichage canonique). */
    nameFr: text('name_fr').notNull(),
    /** Libellé Arabe (nullable pour sources non-MA). */
    nameAr: text('name_ar'),
    /** ISO 3166-1 alpha-2. Défaut 'MA'. */
    countryCode: text('country_code').notNull().default('MA'),
    /** Prix livraison en MAD entier (PAS centimes). */
    deliveryPriceMad: integer('delivery_price_mad').notNull(),
    /** Bucket SLA texte (ex. "24h", "24h - 48h"). Affiché tel quel UI. */
    deliveryEta: text('delivery_eta').notNull(),
    /** Visible côté client si actif. */
    isActive: boolean('is_active').notNull().default(true),
    /** Provenance — restreint via CHECK. */
    source: text('source', { enum: ['sendit', 'manual', 'custom'] })
      .notNull()
      .default('sendit'),
    /** Référence externe d'audit (ex. "sendit:617"). */
    externalRef: text('external_ref'),
    /** Alias additionnels matchables côté autocomplete. */
    aliases: jsonb('aliases').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Métadonnées libres pour évolutions futures sans migration. */
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Ordre manuel (admin « épingle » p. ex. Casablanca en 1er). */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (t) => ({
    slugUnique: uniqueIndex('delivery_cities_slug_unique').on(t.slug),
    activeNameIdx: index('delivery_cities_active_name_idx').on(
      t.isActive,
      t.nameFr,
    ),
    countryActiveIdx: index('delivery_cities_country_active_idx').on(
      t.countryCode,
      t.isActive,
    ),
    // Index expression géré côté migration (text_pattern_ops sur lower(name_fr))
    // — non exprimable en Drizzle. Visible uniquement à l'usage `lower(name_fr)
    // LIKE 'x%'`.
  }),
);

// — Inferred types — — — — — — — — — — — — — — — — — — — — — — — — — — — —
export type FormConfigRow = typeof formConfig.$inferSelect;
export type FormConfigInsert = typeof formConfig.$inferInsert;
export type FormConfigHistoryRow = typeof formConfigHistory.$inferSelect;
export type FormConfigHistoryInsert = typeof formConfigHistory.$inferInsert;
export type ProductStockRow = typeof productStock.$inferSelect;
export type ProductStockInsert = typeof productStock.$inferInsert;
export type FormVariantAssignmentRow = typeof formVariantAssignment.$inferSelect;
export type FormVariantAssignmentInsert = typeof formVariantAssignment.$inferInsert;
export type CheckoutIdempotencyRow = typeof checkoutIdempotency.$inferSelect;
export type CheckoutIdempotencyInsert = typeof checkoutIdempotency.$inferInsert;
export type DeliveryCityRow = typeof deliveryCities.$inferSelect;
export type DeliveryCityInsert = typeof deliveryCities.$inferInsert;

// ===========================================================================
// GTM Poka-Yoke (D-001) — Surveillance runtime de la cohérence GTM
// cf. docs/gtm-poka-yoke/20-data/01-data-model.md
// ===========================================================================

export const gtmSentinelPings = pgTable(
  'gtm_sentinel_pings',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    containerId: text('container_id').notNull(),
    gtmId: text('gtm_id'),
    bundleId: text('bundle_id').notNull(),
    mappingVersion: text('mapping_version').notNull(),
    configVersion: text('config_version').notNull(),
    manifestMismatch: boolean('manifest_mismatch').notNull().default(false),
    manifestMismatchDetails: text('manifest_mismatch_details'),
    uaHash: text('ua_hash'),
    ipHash: text('ip_hash'),
    pageUrlHash: text('page_url_hash'),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    receivedAtDesc: index('idx_gtm_pings_received_at_desc').on(t.receivedAt),
    containerBundle: index('idx_gtm_pings_container_bundle').on(t.containerId, t.bundleId),
    mappingVReceived: index('idx_gtm_pings_mapping_v_received').on(t.mappingVersion, t.receivedAt),
  }),
);

export const gtmDriftState = pgTable('gtm_drift_state', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ['ok', 'warning', 'critical'] }).notNull(),
  since: timestamp('since', { withTimezone: true }).notNull(),
  reasonsJson: jsonb('reasons_json').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  lastPingId: text('last_ping_id'),
  lastCheckAt: timestamp('last_check_at', { withTimezone: true }).notNull().defaultNow(),
  adminSnapshot: jsonb('admin_snapshot').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gtmDriftHistory = pgTable(
  'gtm_drift_history',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    previousStatus: text('previous_status', { enum: ['ok', 'warning', 'critical'] }),
    newStatus: text('new_status', { enum: ['ok', 'warning', 'critical'] }).notNull(),
    reasonsJson: jsonb('reasons_json').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    triggeredByPingId: text('triggered_by_ping_id'),
  },
  (t) => ({
    atDesc: index('idx_gtm_drift_history_at_desc').on(t.at),
  }),
);

export const gtmSentinelDailyAggregates = pgTable(
  'gtm_sentinel_daily_aggregates',
  {
    day: text('day').notNull(),
    bundleId: text('bundle_id').notNull(),
    mappingVersion: text('mapping_version').notNull(),
    configVersion: text('config_version').notNull(),
    containerId: text('container_id').notNull(),
    pingsCount: integer('pings_count').notNull().default(0),
    driftDetected: boolean('drift_detected').notNull().default(false),
    firstPingAt: timestamp('first_ping_at', { withTimezone: true }).notNull(),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.day, t.bundleId] }),
    dayDesc: index('idx_gtm_daily_agg_day_desc').on(t.day),
  }),
);

export type GtmSentinelPingRow = typeof gtmSentinelPings.$inferSelect;
export type GtmSentinelPingInsert = typeof gtmSentinelPings.$inferInsert;
export type GtmDriftStateRow = typeof gtmDriftState.$inferSelect;
export type GtmDriftStateInsert = typeof gtmDriftState.$inferInsert;
export type GtmDriftHistoryRow = typeof gtmDriftHistory.$inferSelect;
export type GtmDriftHistoryInsert = typeof gtmDriftHistory.$inferInsert;
export type GtmSentinelDailyAggregateRow = typeof gtmSentinelDailyAggregates.$inferSelect;
export type GtmSentinelDailyAggregateInsert = typeof gtmSentinelDailyAggregates.$inferInsert;

// — Legal pages — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
export const legalPageStatusEnum = pgEnum('legal_page_status', [
  'draft',
  'review',
  'published',
  'archived',
]);

export const legalLinkStatusEnum = pgEnum('legal_link_status', [
  'ok',
  'page_missing',
  'page_draft',
  'http_4xx',
  'http_5xx',
  'timeout',
]);

export const legalPages = pgTable(
  'legal_pages',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    bodyMd: text('body_md').notNull(),
    status: legalPageStatusEnum('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    includeInSearch: boolean('include_in_search').notNull().default(false),
    canonicalUrl: text('canonical_url'),
    locale: text('locale').notNull().default('fr-MA'),
    requireLegalReview: boolean('require_legal_review').notNull().default(true),
    lastLegalReviewAt: timestamp('last_legal_review_at', { withTimezone: true }),
    lastLegalReviewBy: text('last_legal_review_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: text('submitted_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
  },
  (t) => ({
    slugUnique: uniqueIndex('legal_pages_slug_unique').on(t.slug),
    statusIdx: index('idx_legal_pages_status').on(t.status),
    updatedAtIdx: index('idx_legal_pages_updated_at').on(t.updatedAt),
  }),
);

export const legalPagesHistory = pgTable(
  'legal_pages_history',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => legalPages.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    bodyMd: text('body_md').notNull(),
    metadataJson: jsonb('metadata_json').notNull().default({}),
    statusAtSnapshot: legalPageStatusEnum('status_at_snapshot').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    publishedBy: text('published_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    gitCommitSha: text('git_commit_sha'),
    gitCommitAt: timestamp('git_commit_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageVersionUnique: uniqueIndex('legal_history_page_version_unique').on(t.pageId, t.version),
    pageVersionIdx: index('idx_legal_history_page_version').on(t.pageId, t.version),
    slugDateIdx: index('idx_legal_history_slug_date').on(t.slug, t.publishedAt),
  }),
);

export const legalZones = pgTable('legal_zones', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  description: text('description'),
  maxItemsRecommended: integer('max_items_recommended').notNull().default(5),
  isRequired: boolean('is_required').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const legalPagePlacements = pgTable(
  'legal_page_placements',
  {
    pageSlug: text('page_slug')
      .notNull()
      .references(() => legalPages.slug, { onUpdate: 'cascade', onDelete: 'cascade' }),
    zoneKey: text('zone_key')
      .notNull()
      .references(() => legalZones.key, { onUpdate: 'cascade', onDelete: 'restrict' }),
    displayOrder: integer('display_order').notNull().default(0),
    isVisible: boolean('is_visible').notNull().default(true),
    labelOverride: text('label_override'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageSlug, t.zoneKey] }),
    zoneOrderIdx: index('idx_placements_zone_order').on(t.zoneKey, t.displayOrder),
  }),
);

export const legalTemplateVars = pgTable('legal_template_vars', {
  key: text('key').primaryKey(),
  value: text('value'),
  label: text('label').notNull(),
  description: text('description'),
  isRequired: boolean('is_required').notNull().default(true),
  sensitive: boolean('sensitive').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

export const legalLinkHealthSnapshot = pgTable(
  'legal_link_health_snapshot',
  {
    id: text('id').primaryKey(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    zoneKey: text('zone_key').notNull(),
    pageSlug: text('page_slug').notNull(),
    status: legalLinkStatusEnum('status').notNull(),
    httpCode: integer('http_code'),
    latencyMs: integer('latency_ms'),
    notes: text('notes'),
  },
  (t) => ({
    checkedAtIdx: index('idx_lhs_checked_at').on(t.checkedAt),
    linkIdx: index('idx_lhs_link').on(t.zoneKey, t.pageSlug, t.checkedAt),
    anomalyIdx: index('idx_lhs_anomaly').on(t.status),
  }),
);

export type LegalPageRow = typeof legalPages.$inferSelect;
export type LegalPageInsert = typeof legalPages.$inferInsert;
export type LegalPageHistoryRow = typeof legalPagesHistory.$inferSelect;
export type LegalPageHistoryInsert = typeof legalPagesHistory.$inferInsert;
export type LegalZoneRow = typeof legalZones.$inferSelect;
export type LegalZoneInsert = typeof legalZones.$inferInsert;
export type LegalPagePlacementRow = typeof legalPagePlacements.$inferSelect;
export type LegalPagePlacementInsert = typeof legalPagePlacements.$inferInsert;
export type LegalTemplateVarRow = typeof legalTemplateVars.$inferSelect;
export type LegalTemplateVarInsert = typeof legalTemplateVars.$inferInsert;
export type LegalLinkHealthSnapshotRow = typeof legalLinkHealthSnapshot.$inferSelect;
export type LegalLinkHealthSnapshotInsert = typeof legalLinkHealthSnapshot.$inferInsert;

export const legalSlugRedirects = pgTable('legal_slug_redirects', {
  oldSlug: text('old_slug').primaryKey(),
  newSlug: text('new_slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
});

export type LegalSlugRedirectRow = typeof legalSlugRedirects.$inferSelect;
export type LegalSlugRedirectInsert = typeof legalSlugRedirects.$inferInsert;

/* ─────────────────────────────────────────────────────────────────
 * Product review photos (galerie hero)
 * cf. docs/kit-hero-optim/02-architecture.md §2.2
 * ───────────────────────────────────────────────────────────────── */

export const productReviewPhotos = pgTable(
  'product_review_photos',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    reviewId: text('review_id'),
    src: text('src').notNull(),
    alt: text('alt').notNull().default('Photo cliente'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    blurDataUrl: text('blur_data_url'),
    displayOrder: integer('display_order').notNull().default(0),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('published'),
    reviewerInitials: text('reviewer_initials'),
    reviewerCity: text('reviewer_city'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productOrderIdx: index('idx_review_photos_product').on(
      t.productId,
      t.status,
      t.displayOrder,
    ),
  }),
);

export type ProductReviewPhotoRow = typeof productReviewPhotos.$inferSelect;
export type ProductReviewPhotoInsert = typeof productReviewPhotos.$inferInsert;

/* ─────────────────────────────────────────────────────────────────────
 * COUPONS (migration 0080)
 *
 * Système de coupons piloté par l'admin. En Phase 1, un coupon
 * `welcome_auto` auto-appliqué devient la SOURCE de la promotion `/kit`
 * (re-scénarise le -90 MAD en « geste d'accueil ») — cf.
 * docs/coupon-auto-appliqué.md et le plan d'implémentation.
 *
 * Deux tables :
 *  - `coupons` : définition de campagne (CRUD admin).
 *  - `coupon_events` : log append-only exposition/application/conversion
 *    pour mesurer l'incrémentalité (treatment vs holdout).
 *
 * L'`eligibility` est en JSONB volontairement extensible : les Phases 2
 * (sauvetage ciblé) et 3 (post-achat) n'exigent PAS de migration de schéma.
 * ───────────────────────────────────────────────────────────────────── */

export const couponType = pgEnum('coupon_type', [
  'welcome_auto',
  'rescue',
  'email_unlock',
  'manual_code',
  'post_purchase',
]);

export const couponMode = pgEnum('coupon_mode', ['auto', 'code']);

export const couponStatus = pgEnum('coupon_status', [
  'draft',
  'active',
  'paused',
  'archived',
]);

export const couponValueKind = pgEnum('coupon_value_kind', [
  'fixed_amount',
  'percent',
]);

export const couponTarget = pgEnum('coupon_target', [
  'product_price',
  'shipping',
  'future_credit',
]);

export const couponUsageScope = pgEnum('coupon_usage_scope', [
  'unlimited',
  'once_per_visitor',
  'global_cap',
]);

export const couponEventPhase = pgEnum('coupon_event_phase', [
  'exposed',
  'applied',
  'converted',
]);

export const couponBucket = pgEnum('coupon_bucket', ['treatment', 'holdout']);

export const coupons = pgTable(
  'coupons',
  {
    id: text('id').primaryKey(),
    /** Libellé interne admin (ex. « Geste d'accueil »). */
    label: text('label').notNull(),
    /** `null` pour les coupons `auto` ; rempli + unique pour le mode `code`. */
    code: text('code'),
    type: couponType('type').notNull(),
    mode: couponMode('mode').notNull(),
    status: couponStatus('status').notNull().default('draft'),
    valueKind: couponValueKind('value_kind').notNull(),
    /** Centimes si `fixed_amount` ; points de pourcentage (0..100) si `percent`. */
    valueAmount: integer('value_amount').notNull(),
    target: couponTarget('target').notNull().default('product_price'),
    /** Garde-fou devise (cohérence avec la variante produit). */
    currency: text('currency').notNull().default('MAD'),
    /** Règles d'éligibilité extensibles (`{}` = tout le trafic). */
    eligibility: jsonb('eligibility').notNull().default(sql`'{}'::jsonb`),
    /** Fenêtre de validité — date civile, JAMAIS un countdown. */
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    stackable: boolean('stackable').notNull().default(false),
    usageScope: couponUsageScope('usage_scope').notNull().default('unlimited'),
    usageCap: integer('usage_cap'),
    usageCount: integer('usage_count').notNull().default(0),
    /** % d'éligibles placés en groupe contrôle (pas de coupon appliqué). */
    holdoutPct: integer('holdout_pct').notNull().default(0),
    /** Départage les candidats non-cumulables (plus haut = prioritaire). */
    priority: integer('priority').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
  },
  (t) => ({
    codeUnique: uniqueIndex('coupons_code_unique')
      .on(t.code)
      .where(sql`${t.code} IS NOT NULL`),
    statusTypeIdx: index('coupons_status_type_idx').on(t.status, t.type),
  }),
);

export const couponEvents = pgTable(
  'coupon_events',
  {
    id: text('id').primaryKey(),
    couponId: text('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    phase: couponEventPhase('phase').notNull(),
    bucket: couponBucket('bucket').notNull(),
    /** Hash anonyme du visiteur (PAS de PII). */
    visitorKey: text('visitor_key'),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** Remise effective en centimes au moment de la conversion. */
    amountCents: integer('amount_cents'),
    trafficSource: text('traffic_source'),
    device: text('device'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    couponPhaseIdx: index('coupon_events_coupon_phase_idx').on(
      t.couponId,
      t.phase,
      t.createdAt,
    ),
    visitorIdx: index('coupon_events_visitor_idx').on(t.visitorKey),
    /** Idempotence : une seule conversion par (commande, coupon) — permet à un
     *  même order de porter un converted welcome ET un converted rescue. */
    orderConvertedUnique: uniqueIndex('coupon_events_order_converted_unique')
      .on(t.orderId, t.couponId)
      .where(sql`${t.phase} = 'converted' AND ${t.orderId} IS NOT NULL`),
  }),
);

export type CouponRow = typeof coupons.$inferSelect;
export type CouponInsert = typeof coupons.$inferInsert;
export type CouponEventRow = typeof couponEvents.$inferSelect;
export type CouponEventInsert = typeof couponEvents.$inferInsert;

/* ─────────────────────────────────────────────────────────────────────
 * COUPON GRANTS (migration 0081) — Phase 3 : crédit de fidélité post-achat.
 *
 * Chaque commande émet un `coupon_grant` : un code personnel unique,
 * rattaché au client (chat_lead) et à la commande source, redeemable UNE
 * fois sur une commande ultérieure. La valeur est figée à l'émission
 * (`value_cents`) pour qu'un changement ultérieur du template n'affecte pas
 * les crédits déjà émis. cf. docs/coupons-qa-2026-06-02 (Phase 3).
 * ───────────────────────────────────────────────────────────────────── */

export const couponGrantStatus = pgEnum('coupon_grant_status', [
  'issued',
  'redeemed',
  'expired',
]);

export const couponGrants = pgTable(
  'coupon_grants',
  {
    id: text('id').primaryKey(),
    templateCouponId: text('template_coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    code: text('code').notNull(),
    leadId: text('lead_id'),
    sourceOrderId: text('source_order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    status: couponGrantStatus('status').notNull().default('issued'),
    valueCents: integer('value_cents').notNull(),
    currency: text('currency').notNull().default('MAD'),
    redeemedOrderId: text('redeemed_order_id').references(() => orders.id, {
      onDelete: 'set null',
    }),
    /** Téléphone bénéficiaire (E.164) — unicité + lien client. */
    phoneE164: text('phone_e164'),
    /** Date d'ACTIVATION : commande + durée max de livraison de la ville + 1j.
     *  Le code n'est utilisable qu'à partir de cette date (validateGrant). */
    activatesAt: timestamp('activates_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  },
  (t) => ({
    codeUnique: uniqueIndex('coupon_grants_code_unique').on(t.code),
    statusIdx: index('coupon_grants_status_idx').on(t.status),
    leadIdx: index('coupon_grants_lead_idx').on(t.leadId),
    phoneIdx: index('coupon_grants_phone_idx').on(t.phoneE164),
    /** Un seul code ACTIF (issued) par téléphone — anti-farming. */
    phoneActiveUnique: uniqueIndex('coupon_grants_phone_active_unique')
      .on(t.phoneE164)
      .where(sql`${t.status} = 'issued' AND ${t.phoneE164} IS NOT NULL`),
    sourceOrderUnique: uniqueIndex('coupon_grants_source_order_unique')
      .on(t.sourceOrderId)
      .where(sql`${t.sourceOrderId} IS NOT NULL`),
  }),
);

export type CouponGrantRow = typeof couponGrants.$inferSelect;
export type CouponGrantInsert = typeof couponGrants.$inferInsert;
