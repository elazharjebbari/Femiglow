import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customVector } from './types/vector';
import { contentIdeas } from './schema-content-studio';

export const aiEngineWorkflowConfigs = pgTable(
  'ai_engine_workflow_config',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    name: text('name').notNull(),
    description: text('description'),
    platform: text('platform'),
    format: text('format'),
    graphConfig: jsonb('graph_config').notNull(),
    defaultTone: text('default_tone').notNull().default('professional'),
    defaultLanguage: text('default_language').notNull().default('fr'),
    qualityThreshold: numeric('quality_threshold').notNull().default('0.70'),
    maxRetries: integer('max_retries').notNull().default(3),
    maxBudgetCents: integer('max_budget_cents').notNull().default(100),
    humanReviewRequired: boolean('human_review_required').notNull().default(true),
    autoPublish: boolean('auto_publish').notNull().default(false),
    providerOverrides: jsonb('provider_overrides'),
    version: integer('version').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('ai_wf_active_idx').on(t.isActive, t.createdAt),
    platformFormatIdx: index('ai_wf_platform_format_idx').on(t.platform, t.format),
  }),
);

export const aiEngineProviderConfigs = pgTable(
  'ai_engine_provider_config',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    providerType: text('provider_type').notNull(),
    name: text('name').notNull(),
    apiKeyEnvVar: text('api_key_env_var').notNull(),
    baseUrl: text('base_url'),
    capabilities: text('capabilities').array().notNull(),
    models: jsonb('models').notNull(),
    rateLimitRpm: integer('rate_limit_rpm'),
    dailyBudgetCents: integer('daily_budget_cents'),
    circuitBreakerConfig: jsonb('circuit_breaker_config'),
    priority: integer('priority').notNull().default(50),
    isFallback: boolean('is_fallback').notNull().default(false),
    isEnabled: boolean('is_enabled').notNull().default(true),
    healthStatus: text('health_status').notNull().default('healthy'),
    lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerTypeIdx: index('ai_prov_type_idx').on(t.providerType),
    enabledPriorityIdx: index('ai_prov_enabled_priority_idx').on(t.isEnabled, t.priority),
  }),
);

export const aiEnginePromptTemplates = pgTable(
  'ai_engine_prompt_template',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    nodeName: text('node_name').notNull(),
    name: text('name').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    userPromptTemplate: text('user_prompt_template').notNull(),
    variables: text('variables').array().notNull(),
    version: integer('version').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    parentId: text('parent_id'),
    avgQualityScore: numeric('avg_quality_score'),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nodeActiveIdx: index('ai_pt_node_active_idx').on(t.nodeName, t.isActive),
    parentIdx: index('ai_pt_parent_idx').on(t.parentId),
  }),
);

export const aiEngineKnowledgeCollections = pgTable(
  'ai_engine_knowledge_collection',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    documentCount: integer('document_count').notNull().default(0),
    chunkCount: integer('chunk_count').notNull().default(0),
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex('ai_kc_slug_unique').on(t.slug),
    categoryIdx: index('ai_kc_category_idx').on(t.category, t.isActive),
  }),
);

export const aiEngineKnowledgeDocuments = pgTable(
  'ai_engine_knowledge_document',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    collectionId: text('collection_id')
      .notNull()
      .references(() => aiEngineKnowledgeCollections.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sourceType: text('source_type').notNull(),
    sourceUrl: text('source_url'),
    contentText: text('content_text'),
    metadata: jsonb('metadata'),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    collectionIdx: index('ai_kd_collection_idx').on(t.collectionId, t.createdAt),
    sourceTypeIdx: index('ai_kd_source_type_idx').on(t.sourceType),
  }),
);

// pgvector HNSW index on the embedding column should be created separately
// via raw SQL: CREATE INDEX ai_kch_embedding_hnsw_idx ON ai_engine_knowledge_chunk
//   USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
export const aiEngineKnowledgeChunks = pgTable(
  'ai_engine_knowledge_chunk',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    collectionId: text('collection_id')
      .notNull()
      .references(() => aiEngineKnowledgeCollections.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => aiEngineKnowledgeDocuments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    embedding: customVector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    collectionIdx: index('ai_kch_collection_idx').on(t.collectionId),
    documentIdx: index('ai_kch_document_idx').on(t.documentId),
  }),
);

export const aiEngineGenerationJobs = pgTable(
  'ai_engine_generation_job',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    ideaId: text('idea_id').references(() => contentIdeas.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('pending'),
    briefInput: jsonb('brief_input').notNull(),
    platform: text('platform').notNull(),
    format: text('format').notNull(),
    contentType: text('content_type').notNull(),
    workflowId: text('workflow_id').references(() => aiEngineWorkflowConfigs.id, {
      onDelete: 'set null',
    }),
    currentStep: text('current_step'),
    stateSnapshot: jsonb('state_snapshot'),
    resultAssets: jsonb('result_assets'),
    caption: text('caption'),
    hashtags: text('hashtags').array(),
    totalCostCents: numeric('total_cost_cents').notNull().default('0'),
    costBreakdown: jsonb('cost_breakdown'),
    tokensUsed: jsonb('tokens_used'),
    qualityScores: jsonb('quality_scores'),
    moderationOk: boolean('moderation_ok'),
    humanReviewDecision: jsonb('human_review_decision'),
    errorLog: jsonb('error_log'),
    retryCount: integer('retry_count').notNull().default(0),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('ai_gj_status_idx').on(t.status, t.createdAt),
    ideaIdx: index('ai_gj_idea_idx').on(t.ideaId),
    workflowIdx: index('ai_gj_workflow_idx').on(t.workflowId),
    platformFormatIdx: index('ai_gj_platform_format_idx').on(t.platform, t.format),
  }),
);

export const aiEngineCostLedger = pgTable(
  'ai_engine_cost_ledger',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    jobId: text('job_id').references(() => aiEngineGenerationJobs.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    nodeName: text('node_name').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costCents: numeric('cost_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdx: index('ai_cl_job_idx').on(t.jobId, t.createdAt),
    providerModelIdx: index('ai_cl_provider_model_idx').on(t.provider, t.model, t.createdAt),
    createdAtIdx: index('ai_cl_created_at_idx').on(t.createdAt),
  }),
);

export const aiEngineTrendSignals = pgTable(
  'ai_engine_trend_signal',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    source: text('source').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    originalUrl: text('original_url'),
    brandRelevance: numeric('brand_relevance'),
    viralPotential: numeric('viral_potential'),
    timeSensitivity: numeric('time_sensitivity'),
    contentFeasibility: numeric('content_feasibility'),
    compositeScore: numeric('composite_score'),
    suggestedFormats: text('suggested_formats').array(),
    suggestedBrief: jsonb('suggested_brief'),
    opportunityWindow: text('opportunity_window'),
    riskAssessment: text('risk_assessment').notNull().default('low'),
    status: text('status').notNull().default('new'),
    detectedAt: timestamp('detected_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('ai_ts_status_idx').on(t.status, t.createdAt),
    sourceIdx: index('ai_ts_source_idx').on(t.source, t.createdAt),
    categoryIdx: index('ai_ts_category_idx').on(t.category),
    compositeScoreIdx: index('ai_ts_composite_score_idx').on(t.compositeScore),
    expiresAtIdx: index('ai_ts_expires_at_idx').on(t.expiresAt),
  }),
);

export const aiEngineApiKeys = pgTable(
  'ai_engine_api_key',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
    providerType: text('provider_type').notNull(),
    label: text('label').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyLastFour: text('key_last_four').notNull(),
    baseUrl: text('base_url'),
    isActive: boolean('is_active').notNull().default(true),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestResult: text('last_test_result'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerTypeIdx: index('ai_ak_provider_type_idx').on(t.providerType),
    activeIdx: index('ai_ak_active_idx').on(t.isActive),
    uniqueActiveProvider: uniqueIndex('ai_ak_unique_active_provider').on(t.providerType, t.isActive),
  }),
);
