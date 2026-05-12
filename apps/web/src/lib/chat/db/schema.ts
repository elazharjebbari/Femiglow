/**
 * CHA-011 → CHA-015 — Schémas Drizzle du module chat.
 *
 * 11 tables couvrant : sessions visiteurs, messages, base de
 * connaissance + embeddings (pgvector), config providers chiffrée,
 * versions d'instructions immuables, presets de thème, événements
 * KPI append-only, feedbacks, rate-limit buckets.
 *
 * cf. docs/chat-assistant/02-data.md
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { customVector } from '@/lib/db/types/vector';

// ---------------------------------------------------------------------------
// chat_instruction_version (référencé par chat_session)
// ---------------------------------------------------------------------------

export const chatInstructionVersion = pgTable(
  'chat_instruction_version',
  {
    id: text('id').primaryKey(), // ci_xxxxxxxx
    version: integer('version').notNull(),
    scope: text('scope').notNull().default('default'),
    body: text('body').notNull(),
    bodyAr: text('body_ar'),
    bodyArMa: text('body_ar_ma'),
    notes: text('notes'),
    enabled: boolean('enabled').notNull().default(false),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    scopeVersionIdx: uniqueIndex('chat_iv_scope_version_idx').on(t.scope, t.version),
    activeIdx: uniqueIndex('chat_iv_active_idx')
      .on(t.scope)
      .where(sql`${t.enabled} = true`),
  }),
);

// ---------------------------------------------------------------------------
// chat_theme_preset
// ---------------------------------------------------------------------------

export const chatThemePreset = pgTable('chat_theme_preset', {
  id: text('id').primaryKey(), // ct_xxxxxxxx
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  tokens: jsonb('tokens')
    .$type<Record<string, string | number>>()
    .notNull(),
  layout: jsonb('layout')
    .$type<{
      position: 'bottom-right' | 'bottom-left';
      panel: { width: number; maxHeight: number; radius: number };
      mobile: { fullscreen: boolean };
    }>()
    .notNull(),
  motion: jsonb('motion')
    .$type<{
      humanize: { jitterMinMs: number; jitterMaxMs: number; punctPauseMs: number };
      easings: Record<string, string>;
    }>()
    .notNull(),
  pageSalutations: jsonb('page_salutations').$type<
    Array<{
      pathPattern: string;
      fr: string;
      ar?: string;
      arMa?: string;
      timeWindow?: 'morning' | 'afternoon' | 'evening';
    }>
  >(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// chat_provider_config
// ---------------------------------------------------------------------------

export const chatProviderConfig = pgTable(
  'chat_provider_config',
  {
    id: text('id').primaryKey(), // cp_xxxxxxxx
    kind: text('kind', {
      enum: [
        'openai',
        'gemini',
        'anthropic',
        'mistral',
        'qwen',
        'deepseek',
        'zhipu',
        'ollama',
        'azure-openai',
      ],
    }).notNull(),
    label: text('label').notNull(),
    priority: integer('priority').notNull().default(100),
    enabled: boolean('enabled').notNull().default(true),
    role: text('role', { enum: ['chat', 'embedding', 'moderation', 'rerank'] }).notNull(),
    chatModel: text('chat_model'),
    embeddingModel: text('embedding_model'),
    moderationModel: text('moderation_model'),
    apiBase: text('api_base'),
    apiKeyEncrypted: text('api_key_encrypted'),
    apiKeyIv: text('api_key_iv'),
    headers: jsonb('headers').$type<Record<string, string>>(),
    parameters: jsonb('parameters').$type<{
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      timeoutMs?: number;
    }>(),
    quotaMonthlyEur: numeric('quota_monthly_eur', { precision: 10, scale: 2 }),
    consumedMonthEur: numeric('consumed_month_eur', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    consumedResetAt: timestamp('consumed_reset_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    egressAllowed: boolean('egress_allowed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rolePriorityIdx: index('chat_pc_role_priority_idx').on(t.role, t.priority, t.enabled),
  }),
);

// ---------------------------------------------------------------------------
// chat_session
// ---------------------------------------------------------------------------

export const chatSession = pgTable(
  'chat_session',
  {
    id: text('id').primaryKey(), // cs_xxxxxxxx
    visitorId: text('visitor_id').notNull(),
    fingerprintHash: text('fingerprint_hash'),
    language: text('language').notNull().default('fr'),
    page: text('page'),
    referrer: text('referrer'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    instructionVersionId: text('instruction_version_id')
      .notNull()
      .references(() => chatInstructionVersion.id),
    themePresetId: text('theme_preset_id').references(() => chatThemePreset.id),
    experimentVariantId: text('experiment_variant_id'),
    status: text('status', { enum: ['open', 'idle', 'archived', 'purged'] })
      .notNull()
      .default('open'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    consent: jsonb('consent').$type<{
      essential: true;
      analytics: boolean;
      marketing: boolean;
    }>(),
    convertedOrderId: text('converted_order_id'),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    metaSummary: text('meta_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    visitorIdx: index('chat_session_visitor_idx').on(t.visitorId),
    statusIdx: index('chat_session_status_idx').on(t.status, t.lastSeenAt),
    convIdx: index('chat_session_conv_idx').on(t.convertedAt),
    pageIdx: index('chat_session_page_idx').on(t.page),
  }),
);

// ---------------------------------------------------------------------------
// chat_message
// ---------------------------------------------------------------------------

export const chatMessage = pgTable(
  'chat_message',
  {
    id: text('id').primaryKey(), // cm_xxxxxxxx
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSession.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
    content: text('content').notNull(),
    contentRaw: text('content_raw'),
    contentSafe: text('content_safe'),
    language: text('language'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms'),
    firstTokenMs: integer('first_token_ms'),
    providerId: text('provider_id').references(() => chatProviderConfig.id),
    modelName: text('model_name'),
    ragHits: jsonb('rag_hits').$type<Array<{ chunkId: string; score: number }>>(),
    moderation: jsonb('moderation').$type<{
      input?: { flagged: boolean; categories: string[] };
      output?: { flagged: boolean; rewritten: boolean };
    }>(),
    cost: numeric('cost', { precision: 10, scale: 6 }),
    status: text('status', {
      enum: ['pending', 'streaming', 'sent', 'error', 'deleted'],
    })
      .notNull()
      .default('sent'),
    errorCode: text('error_code'),
    parentMessageId: text('parent_message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionCreatedIdx: index('chat_message_session_created_idx').on(
      t.sessionId,
      t.createdAt,
    ),
    statusIdx: index('chat_message_status_idx').on(t.status),
    // L'index GIN tsvector est créé en SQL brut dans la migration
    // (Drizzle ne sait pas exprimer `to_tsvector(...)` via le DSL).
  }),
);

// ---------------------------------------------------------------------------
// chat_knowledge_source
// ---------------------------------------------------------------------------

export const chatKnowledgeSource = pgTable(
  'chat_knowledge_source',
  {
    id: text('id').primaryKey(), // ck_xxxxxxxx
    kind: text('kind', {
      enum: ['url', 'markdown', 'pdf', 'docx', 'faq', 'snippet'],
    }).notNull(),
    label: text('label').notNull(),
    locator: text('locator'),
    blobUrl: text('blob_url'),
    rawHash: text('raw_hash').notNull(),
    language: text('language').notNull().default('fr'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    audience: text('audience', { enum: ['public', 'b2b', 'all'] })
      .notNull()
      .default('all'),
    freshness: text('freshness', { enum: ['evergreen', 'seasonal', 'volatile'] })
      .notNull()
      .default('evergreen'),
    enabled: boolean('enabled').notNull().default(true),
    lastIngestedAt: timestamp('last_ingested_at', { withTimezone: true }),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    enabledIdx: index('chat_ks_enabled_idx').on(t.enabled, t.language),
    hashIdx: uniqueIndex('chat_ks_hash_idx').on(t.rawHash, t.language),
  }),
);

// ---------------------------------------------------------------------------
// chat_knowledge_chunk
// ---------------------------------------------------------------------------

export const chatKnowledgeChunk = pgTable(
  'chat_knowledge_chunk',
  {
    id: text('id').primaryKey(), // kc_xxxxxxxx
    sourceId: text('source_id')
      .notNull()
      .references(() => chatKnowledgeSource.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    tokens: integer('tokens').notNull(),
    metadata: jsonb('metadata').$type<{
      heading?: string;
      url?: string;
      anchor?: string;
      page?: number;
      lastUpdatedAt?: string;
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceOrdIdx: uniqueIndex('chat_kc_source_ord_idx').on(t.sourceId, t.ordinal),
    hashIdx: index('chat_kc_hash_idx').on(t.contentHash),
  }),
);

// ---------------------------------------------------------------------------
// chat_knowledge_embedding (pgvector)
// ---------------------------------------------------------------------------

export const chatKnowledgeEmbedding = pgTable(
  'chat_knowledge_embedding',
  {
    id: text('id').primaryKey(), // ke_xxxxxxxx
    chunkId: text('chunk_id')
      .notNull()
      .references(() => chatKnowledgeChunk.id, { onDelete: 'cascade' }),
    embedderProvider: text('embedder_provider').notNull(),
    embedderModel: text('embedder_model').notNull(),
    dim: integer('dim').notNull(),
    vector: customVector('vector', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    chunkUniqIdx: uniqueIndex('chat_ke_chunk_uniq_idx').on(t.chunkId, t.embedderModel),
    // L'index HNSW (`USING hnsw (vector vector_cosine_ops)`) est
    // créé en SQL brut dans la migration : Drizzle 0.45 expose
    // `index().using('hnsw', ...)` mais le mapping op-class est
    // récent → on garde la version SQL pour la portabilité.
  }),
);

// ---------------------------------------------------------------------------
// chat_conversation_event (KPI source de vérité)
// ---------------------------------------------------------------------------

export const chatConversationEvent = pgTable(
  'chat_conversation_event',
  {
    id: text('id').primaryKey(), // cv_xxxxxxxx
    sessionId: text('session_id').notNull(),
    type: text('type', {
      enum: [
        'session_open',
        'widget_open',
        'widget_close',
        'message_sent_user',
        'message_sent_agent',
        'message_received_first_token',
        'message_complete',
        'feedback_positive',
        'feedback_negative',
        'suggestion_clicked',
        'language_switch',
        'error',
        'rate_limit_hit',
        'conversion_attributed',
        'lead_email_captured',
        // CHA-203 — capture lead par formulaire in-chat
        'chat_lead_form_offered',
        'chat_lead_form_view',
        'chat_lead_form_focus',
        'chat_lead_form_dismiss',
        'chat_lead_form_submit',
        'chat_lead_webhook_sent',
        'chat_lead_webhook_failed',
        // CHA-225 — capture automatique d'un téléphone in-chat (filet de
        // sécurité commercial : le visiteur a tapé son numéro dans le
        // chat sans soumettre le formulaire, on crée le lead direct).
        'chat_lead_auto_created',
        // CHA-225 — formalisation d'un lead `inline-contact` en lead
        // formel après soumission du formulaire (consent RGPD propre).
        'chat_lead_form_upgrade',
      ],
    }).notNull(),
    payload: jsonb('payload'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('chat_ce_session_idx').on(t.sessionId, t.occurredAt),
    typeOccurredIdx: index('chat_ce_type_occurred_idx').on(t.type, t.occurredAt),
  }),
);

// ---------------------------------------------------------------------------
// chat_feedback
// ---------------------------------------------------------------------------

export const chatFeedback = pgTable(
  'chat_feedback',
  {
    id: text('id').primaryKey(), // cf_xxxxxxxx
    messageId: text('message_id')
      .notNull()
      .references(() => chatMessage.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    value: integer('value').notNull(), // -1 | 1
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    messageUniqIdx: uniqueIndex('chat_fb_message_uniq_idx').on(t.messageId),
  }),
);

// ---------------------------------------------------------------------------
// chat_rate_limit_bucket
// ---------------------------------------------------------------------------

export const chatRateLimitBucket = pgTable(
  'chat_rate_limit_bucket',
  {
    id: text('id').primaryKey(), // cr_xxxxxxxx
    scope: text('scope', { enum: ['ip', 'session', 'visitor'] }).notNull(),
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    scopeKeyIdx: uniqueIndex('chat_rl_scope_key_idx').on(
      t.scope,
      t.key,
      t.windowStart,
    ),
    expIdx: index('chat_rl_exp_idx').on(t.expiresAt),
  }),
);

// ---------------------------------------------------------------------------
// chat_runtime_setting — toggle runtime piloté depuis l'admin (clé/valeur).
// Le `CHAT_ENABLED` côté env reste un kill switch ; ce toggle DB ne
// peut activer que si l'env autorise déjà.
// ---------------------------------------------------------------------------

export const chatRuntimeSetting = pgTable('chat_runtime_setting', {
  key: text('key').primaryKey(), // ex. 'enabled'
  valueBool: boolean('value_bool'),
  valueText: text('value_text'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// chat_lead — CHA-200 — capture de contact in-chat (prénom + téléphone).
//
// La conversation qui a déclenché l'offre est liée via `sessionId` +
// `triggeringMessageId` (le dernier message assistant qui a poussé le
// formulaire). On stocke un snapshot court des derniers messages pour
// que l'agent humain ait le contexte sans relire toute la session.
// ---------------------------------------------------------------------------

export const chatLead = pgTable(
  'chat_lead',
  {
    id: text('id').primaryKey(), // cl_xxxxxxxx
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSession.id, { onDelete: 'cascade' }),
    triggeringMessageId: text('triggering_message_id'),
    triggerReason: text('trigger_reason', {
      enum: [
        'explicit-request',
        'out-of-knowledge',
        'objection-repeat',
        'long-no-progress',
        'frustration',
        'after-hours',
        'b2b',
        // CHA-225 — purchase-intent (achat explicite déclenché dès le 1er
        // tour) + inline-contact (l'utilisateur a écrit son téléphone dans
        // le chat → on capture proprement via le formulaire).
        'purchase-intent',
        'inline-contact',
        'manual',
      ],
    }).notNull(),
    firstName: text('first_name').notNull(),
    phoneE164: text('phone_e164').notNull(),
    phoneRaw: text('phone_raw').notNull(),
    note: text('note'),
    consentVersion: text('consent_version').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
    visitorId: text('visitor_id').notNull(),
    fingerprintHash: text('fingerprint_hash'),
    page: text('page'),
    referrer: text('referrer'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    language: text('language').notNull(),
    intentAtCapture: text('intent_at_capture'),
    snapshotMessages: jsonb('snapshot_messages').$type<
      Array<{ role: 'user' | 'assistant'; content: string; at: string }>
    >(),
    webhookStatus: text('webhook_status', {
      enum: ['pending', 'sent', 'failed', 'disabled'],
    })
      .notNull()
      .default('pending'),
    webhookAttempts: integer('webhook_attempts').notNull().default(0),
    webhookLastError: text('webhook_last_error'),
    webhookSentAt: timestamp('webhook_sent_at', { withTimezone: true }),
    handledBy: text('handled_by'),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    outcome: text('outcome', {
      enum: ['pending', 'reached', 'no-answer', 'converted', 'discarded'],
    })
      .notNull()
      .default('pending'),
    convertedOrderId: text('converted_order_id'),

    // ──────────────────────────────────────────────────────────────────────
    // CHA-230 — Extensions wizard checkout funnel.
    // Toutes nullable ou avec DEFAULT pour préserver les leads legacy.
    // ──────────────────────────────────────────────────────────────────────

    // Identité étendue (opt-in step 4 et step 2)
    lastName: text('last_name'),
    email: text('email'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    emailConsent: boolean('email_consent').notNull().default(false),

    // Adresse de livraison (step 2)
    shippingCity: text('shipping_city'),
    shippingAddressLine1: text('shipping_address_line1'),
    shippingAddressLine2: text('shipping_address_line2'),
    shippingPostalCode: text('shipping_postal_code'),
    shippingCountry: text('shipping_country').notNull().default('MA'),
    shippingNotes: text('shipping_notes'),

    // Préférence paiement (step 3)
    preferredPaymentMethod: text('preferred_payment_method', {
      enum: ['cod', 'bank_transfer', 'card'],
    }),

    // Source / Form context (cohérent avec la taxonomie tracking — cf.
    // apps/web/src/lib/tracking/checkout-events.ts)
    source: text('source', {
      enum: ['chat_widget', 'wizard_kit', 'wizard_commander', 'newsletter', 'admin', 'inline'],
    })
      .notNull()
      .default('chat_widget'),
    formId: text('form_id'),
    formMode: text('form_mode', {
      enum: ['wizard_embed', 'wizard_cart', 'legacy_cart', 'chat'],
    }),
    variantKey: text('variant_key', { enum: ['A', 'B', 'control'] }),

    // Ad attribution (Google / Meta)
    gclid: text('gclid'),
    fbp: text('fbp'),
    fbc: text('fbc'),

    // Snapshot panier au moment de la capture
    cartSnapshot: jsonb('cart_snapshot').$type<{
      items: Array<{ sku: string; name: string; quantity: number; unitPriceCents: number }>;
      totalCents: number;
      currency: string;
    }>(),
    cartTotalCents: integer('cart_total_cents'),
    cartCurrency: text('cart_currency'),

    // Progression du tunnel (horloges par step)
    lastTouchedStep: text('last_touched_step', {
      enum: ['cart_review', 'lead', 'address', 'payment', 'thank_you'],
    }),
    leadCapturedAt: timestamp('lead_captured_at', { withTimezone: true }),
    addressCompletedAt: timestamp('address_completed_at', { withTimezone: true }),
    paymentSelectedAt: timestamp('payment_selected_at', { withTimezone: true }),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('chat_lead_session_idx').on(t.sessionId, t.createdAt),
    visitorIdx: index('chat_lead_visitor_idx').on(t.visitorId),
    outcomeIdx: index('chat_lead_outcome_idx').on(t.outcome, t.createdAt),
    webhookIdx: index('chat_lead_webhook_idx').on(t.webhookStatus, t.createdAt),
    phoneIdx: index('chat_lead_phone_idx').on(t.phoneE164),
    // CHA-230 — Indexes funnel
    sourceIdx: index('chat_lead_source_idx').on(t.source, t.createdAt),
    formIdx: index('chat_lead_form_idx').on(t.formId, t.formMode, t.createdAt),
    stepIdx: index('chat_lead_step_idx').on(t.lastTouchedStep, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Inferred row / insert types
// ---------------------------------------------------------------------------

export type ChatSessionRow = typeof chatSession.$inferSelect;
export type ChatSessionInsert = typeof chatSession.$inferInsert;
export type ChatMessageRow = typeof chatMessage.$inferSelect;
export type ChatMessageInsert = typeof chatMessage.$inferInsert;
export type ChatProviderConfigRow = typeof chatProviderConfig.$inferSelect;
export type ChatProviderConfigInsert = typeof chatProviderConfig.$inferInsert;
export type ChatInstructionVersionRow = typeof chatInstructionVersion.$inferSelect;
export type ChatThemePresetRow = typeof chatThemePreset.$inferSelect;
export type ChatKnowledgeSourceRow = typeof chatKnowledgeSource.$inferSelect;
export type ChatKnowledgeSourceInsert = typeof chatKnowledgeSource.$inferInsert;
export type ChatKnowledgeChunkRow = typeof chatKnowledgeChunk.$inferSelect;
export type ChatKnowledgeChunkInsert = typeof chatKnowledgeChunk.$inferInsert;
export type ChatKnowledgeEmbeddingRow = typeof chatKnowledgeEmbedding.$inferSelect;
export type ChatKnowledgeEmbeddingInsert = typeof chatKnowledgeEmbedding.$inferInsert;
export type ChatConversationEventRow = typeof chatConversationEvent.$inferSelect;
export type ChatFeedbackRow = typeof chatFeedback.$inferSelect;
export type ChatRateLimitBucketRow = typeof chatRateLimitBucket.$inferSelect;
export type ChatRuntimeSettingRow = typeof chatRuntimeSetting.$inferSelect;
export type ChatRuntimeSettingInsert = typeof chatRuntimeSetting.$inferInsert;
export type ChatLeadRow = typeof chatLead.$inferSelect;
export type ChatLeadInsert = typeof chatLead.$inferInsert;
