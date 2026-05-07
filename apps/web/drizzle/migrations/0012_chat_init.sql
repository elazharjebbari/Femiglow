-- CHA-016 — Migration initiale du module chat assistant.
-- 11 tables + extension pgvector + index full-text GIN + index HNSW.
-- cf. docs/chat-assistant/02-data.md
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint

CREATE TABLE "chat_instruction_version" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"scope" text DEFAULT 'default' NOT NULL,
	"body" text NOT NULL,
	"body_ar" text,
	"body_ar_ma" text,
	"notes" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_theme_preset" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"tokens" jsonb NOT NULL,
	"layout" jsonb NOT NULL,
	"motion" jsonb NOT NULL,
	"page_salutations" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_provider_config" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"role" text NOT NULL,
	"chat_model" text,
	"embedding_model" text,
	"moderation_model" text,
	"api_base" text,
	"api_key_encrypted" text,
	"api_key_iv" text,
	"headers" jsonb,
	"parameters" jsonb,
	"quota_monthly_eur" numeric(10, 2),
	"consumed_month_eur" numeric(10, 6) DEFAULT '0' NOT NULL,
	"consumed_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"egress_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_session" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"fingerprint_hash" text,
	"language" text DEFAULT 'fr' NOT NULL,
	"page" text,
	"referrer" text,
	"utm" jsonb,
	"instruction_version_id" text NOT NULL REFERENCES "chat_instruction_version"("id"),
	"theme_preset_id" text REFERENCES "chat_theme_preset"("id"),
	"experiment_variant_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"consent" jsonb,
	"converted_order_id" text,
	"converted_at" timestamp with time zone,
	"meta_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL REFERENCES "chat_session"("id") ON DELETE CASCADE,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"content_raw" text,
	"content_safe" text,
	"language" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"first_token_ms" integer,
	"provider_id" text REFERENCES "chat_provider_config"("id"),
	"model_name" text,
	"rag_hits" jsonb,
	"moderation" jsonb,
	"cost" numeric(10, 6),
	"status" text DEFAULT 'sent' NOT NULL,
	"error_code" text,
	"parent_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_knowledge_source" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"locator" text,
	"blob_url" text,
	"raw_hash" text NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"freshness" text DEFAULT 'evergreen' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_ingested_at" timestamp with time zone,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_knowledge_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL REFERENCES "chat_knowledge_source"("id") ON DELETE CASCADE,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"tokens" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_knowledge_embedding" (
	"id" text PRIMARY KEY NOT NULL,
	"chunk_id" text NOT NULL REFERENCES "chat_knowledge_chunk"("id") ON DELETE CASCADE,
	"embedder_provider" text NOT NULL,
	"embedder_model" text NOT NULL,
	"dim" integer NOT NULL,
	"vector" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_conversation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL REFERENCES "chat_message"("id") ON DELETE CASCADE,
	"session_id" text NOT NULL,
	"value" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "chat_rate_limit_bucket" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE UNIQUE INDEX "chat_iv_scope_version_idx" ON "chat_instruction_version" ("scope", "version");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_iv_active_idx" ON "chat_instruction_version" ("scope") WHERE "enabled" = true;--> statement-breakpoint
CREATE INDEX "chat_pc_role_priority_idx" ON "chat_provider_config" ("role", "priority", "enabled");--> statement-breakpoint
CREATE INDEX "chat_session_visitor_idx" ON "chat_session" ("visitor_id");--> statement-breakpoint
CREATE INDEX "chat_session_status_idx" ON "chat_session" ("status", "last_seen_at");--> statement-breakpoint
CREATE INDEX "chat_session_conv_idx" ON "chat_session" ("converted_at");--> statement-breakpoint
CREATE INDEX "chat_session_page_idx" ON "chat_session" ("page");--> statement-breakpoint
CREATE INDEX "chat_message_session_created_idx" ON "chat_message" ("session_id", "created_at");--> statement-breakpoint
CREATE INDEX "chat_message_status_idx" ON "chat_message" ("status");--> statement-breakpoint
CREATE INDEX "chat_message_fulltext_idx" ON "chat_message" USING GIN (to_tsvector('simple', "content"));--> statement-breakpoint
CREATE INDEX "chat_ks_enabled_idx" ON "chat_knowledge_source" ("enabled", "language");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_ks_hash_idx" ON "chat_knowledge_source" ("raw_hash", "language");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_kc_source_ord_idx" ON "chat_knowledge_chunk" ("source_id", "ordinal");--> statement-breakpoint
CREATE INDEX "chat_kc_hash_idx" ON "chat_knowledge_chunk" ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_ke_chunk_uniq_idx" ON "chat_knowledge_embedding" ("chunk_id", "embedder_model");--> statement-breakpoint
CREATE INDEX "chat_ke_hnsw_idx" ON "chat_knowledge_embedding" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chat_ce_session_idx" ON "chat_conversation_event" ("session_id", "occurred_at");--> statement-breakpoint
CREATE INDEX "chat_ce_type_occurred_idx" ON "chat_conversation_event" ("type", "occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_fb_message_uniq_idx" ON "chat_feedback" ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_rl_scope_key_idx" ON "chat_rate_limit_bucket" ("scope", "key", "window_start");--> statement-breakpoint
CREATE INDEX "chat_rl_exp_idx" ON "chat_rate_limit_bucket" ("expires_at");
