-- 0060 — AI Engine tables
-- Creates 9 tables for the AI content generation engine:
--   workflow configs, provider configs, prompt templates, knowledge (collection/document/chunk),
--   generation jobs, cost ledger, trend signals.

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. ai_engine_workflow_config
CREATE TABLE IF NOT EXISTS ai_engine_workflow_config (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  description      TEXT,
  platform         TEXT,
  format           TEXT,
  graph_config     JSONB NOT NULL,
  default_tone     TEXT NOT NULL DEFAULT 'professional',
  default_language TEXT NOT NULL DEFAULT 'fr',
  quality_threshold NUMERIC NOT NULL DEFAULT 0.70,
  max_retries      INTEGER NOT NULL DEFAULT 3,
  max_budget_cents INTEGER NOT NULL DEFAULT 100,
  human_review_required BOOLEAN NOT NULL DEFAULT true,
  auto_publish     BOOLEAN NOT NULL DEFAULT false,
  provider_overrides JSONB,
  version          INTEGER NOT NULL DEFAULT 1,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_wf_active_idx ON ai_engine_workflow_config (is_active, created_at);
CREATE INDEX IF NOT EXISTS ai_wf_platform_format_idx ON ai_engine_workflow_config (platform, format);

-- 2. ai_engine_provider_config
CREATE TABLE IF NOT EXISTS ai_engine_provider_config (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider_type         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  api_key_env_var       TEXT NOT NULL,
  base_url              TEXT,
  capabilities          TEXT[] NOT NULL,
  models                JSONB NOT NULL,
  rate_limit_rpm        INTEGER,
  daily_budget_cents    INTEGER,
  circuit_breaker_config JSONB,
  priority              INTEGER NOT NULL DEFAULT 50,
  is_fallback           BOOLEAN NOT NULL DEFAULT false,
  is_enabled            BOOLEAN NOT NULL DEFAULT true,
  health_status         TEXT NOT NULL DEFAULT 'healthy',
  last_health_check     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_prov_type_idx ON ai_engine_provider_config (provider_type);
CREATE INDEX IF NOT EXISTS ai_prov_enabled_priority_idx ON ai_engine_provider_config (is_enabled, priority);

-- 3. ai_engine_prompt_template
CREATE TABLE IF NOT EXISTS ai_engine_prompt_template (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  node_name             TEXT NOT NULL,
  name                  TEXT NOT NULL,
  system_prompt         TEXT NOT NULL,
  user_prompt_template  TEXT NOT NULL,
  variables             TEXT[] NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  parent_id             TEXT REFERENCES ai_engine_prompt_template(id) ON DELETE SET NULL,
  avg_quality_score     NUMERIC,
  usage_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_pt_node_active_idx ON ai_engine_prompt_template (node_name, is_active);
CREATE INDEX IF NOT EXISTS ai_pt_parent_idx ON ai_engine_prompt_template (parent_id);

-- 4. ai_engine_knowledge_collection
CREATE TABLE IF NOT EXISTS ai_engine_knowledge_collection (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,
  document_count  INTEGER NOT NULL DEFAULT 0,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  last_indexed_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_kc_slug_unique ON ai_engine_knowledge_collection (slug);
CREATE INDEX IF NOT EXISTS ai_kc_category_idx ON ai_engine_knowledge_collection (category, is_active);

-- 5. ai_engine_knowledge_document
CREATE TABLE IF NOT EXISTS ai_engine_knowledge_document (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collection_id   TEXT NOT NULL REFERENCES ai_engine_knowledge_collection(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  source_url      TEXT,
  content_text    TEXT,
  metadata        JSONB,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_kd_collection_idx ON ai_engine_knowledge_document (collection_id, created_at);
CREATE INDEX IF NOT EXISTS ai_kd_source_type_idx ON ai_engine_knowledge_document (source_type);

-- 6. ai_engine_knowledge_chunk
CREATE TABLE IF NOT EXISTS ai_engine_knowledge_chunk (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collection_id   TEXT NOT NULL REFERENCES ai_engine_knowledge_collection(id) ON DELETE CASCADE,
  document_id     TEXT NOT NULL REFERENCES ai_engine_knowledge_document(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  metadata        JSONB,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_kch_collection_idx ON ai_engine_knowledge_chunk (collection_id);
CREATE INDEX IF NOT EXISTS ai_kch_document_idx ON ai_engine_knowledge_chunk (document_id);

-- HNSW index for vector similarity search — run separately on production
-- if the table has many rows, consider CREATE INDEX CONCURRENTLY instead.
-- CREATE INDEX ai_kch_embedding_hnsw_idx ON ai_engine_knowledge_chunk
--   USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 7. ai_engine_generation_job
CREATE TABLE IF NOT EXISTS ai_engine_generation_job (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  idea_id               TEXT REFERENCES content_idea(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  brief_input           JSONB NOT NULL,
  platform              TEXT NOT NULL,
  format                TEXT NOT NULL,
  content_type          TEXT NOT NULL,
  workflow_id           TEXT REFERENCES ai_engine_workflow_config(id) ON DELETE SET NULL,
  current_step          TEXT,
  state_snapshot        JSONB,
  result_assets         JSONB,
  caption               TEXT,
  hashtags              TEXT[],
  total_cost_cents      NUMERIC NOT NULL DEFAULT 0,
  cost_breakdown        JSONB,
  tokens_used           JSONB,
  quality_scores        JSONB,
  moderation_ok         BOOLEAN,
  human_review_decision JSONB,
  error_log             JSONB,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  duration_ms           INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_gj_status_idx ON ai_engine_generation_job (status, created_at);
CREATE INDEX IF NOT EXISTS ai_gj_idea_idx ON ai_engine_generation_job (idea_id);
CREATE INDEX IF NOT EXISTS ai_gj_workflow_idx ON ai_engine_generation_job (workflow_id);
CREATE INDEX IF NOT EXISTS ai_gj_platform_format_idx ON ai_engine_generation_job (platform, format);

-- 8. ai_engine_cost_ledger
CREATE TABLE IF NOT EXISTS ai_engine_cost_ledger (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id          TEXT REFERENCES ai_engine_generation_job(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  node_name       TEXT NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_cents      NUMERIC NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_cl_job_idx ON ai_engine_cost_ledger (job_id, created_at);
CREATE INDEX IF NOT EXISTS ai_cl_provider_model_idx ON ai_engine_cost_ledger (provider, model, created_at);
CREATE INDEX IF NOT EXISTS ai_cl_created_at_idx ON ai_engine_cost_ledger (created_at);

-- 9. ai_engine_trend_signal
CREATE TABLE IF NOT EXISTS ai_engine_trend_signal (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source               TEXT NOT NULL,
  category             TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  original_url         TEXT,
  brand_relevance      NUMERIC,
  viral_potential      NUMERIC,
  time_sensitivity     NUMERIC,
  content_feasibility  NUMERIC,
  composite_score      NUMERIC,
  suggested_formats    TEXT[],
  suggested_brief      JSONB,
  opportunity_window   TEXT,
  risk_assessment      TEXT NOT NULL DEFAULT 'low',
  status               TEXT NOT NULL DEFAULT 'new',
  detected_at          TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_ts_status_idx ON ai_engine_trend_signal (status, created_at);
CREATE INDEX IF NOT EXISTS ai_ts_source_idx ON ai_engine_trend_signal (source, created_at);
CREATE INDEX IF NOT EXISTS ai_ts_category_idx ON ai_engine_trend_signal (category);
CREATE INDEX IF NOT EXISTS ai_ts_composite_score_idx ON ai_engine_trend_signal (composite_score);
CREATE INDEX IF NOT EXISTS ai_ts_expires_at_idx ON ai_engine_trend_signal (expires_at);
