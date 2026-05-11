import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull(),
    shippingMode: text('shipping_mode').notNull(),
    paymentMethod: text('payment_method').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    leadIdx: index('orders_lead_idx').on(t.leadId),
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
  'section_content',
  'section_testimonial',
  'section_faq',
  'commerce_cart',
  'commerce_checkout',
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
  },
  (t) => ({
    nameUnique: uniqueIndex('tracking_event_def_name_unique').on(t.name),
    categoryIdx: index('tracking_event_def_category_idx').on(t.category),
    funnelStageIdx: index('tracking_event_def_funnel_stage_idx').on(t.funnelStage),
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

export const ritualLanguage = pgEnum('ritual_language', ['fr', 'ar']);

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
