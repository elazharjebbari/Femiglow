-- ===========================================================================
-- Migration 0028 — Chat V5/V6 : intents + canned pairs + FAQ entries
-- ---------------------------------------------------------------------------
-- CHA-300 — Cascade de routing chat V5/V6.
--
-- Ajoute 5 tables :
--   1) chat_intent_centroid      — vecteur agrégé par intent (cascade L1)
--   2) chat_intent_example       — dataset de phrases labellisées
--   3) chat_canned_pair          — pills SuggestionPills + scripted reply
--   4) chat_canned_pair_version  — historique immutable des bodies
--   5) chat_faq_entry            — FAQ avec embedding question (cascade L3)
--
-- + 2 index HNSW (vector_cosine_ops, m=16, ef_construction=64) :
--   - chat_intent_centroid.vector
--   - chat_faq_entry.question_embedding
--
-- Conventions :
--   - id text PRIMARY KEY (préfixes : ic_, ie_, cnp_, cnv_, fq_)
--   - language : ENUM as text + CHECK
--   - status : ENUM as text + CHECK
--   - HNSW créé dans cette migration (additif, rollback-safe via DROP INDEX)
--
-- cf. docs/dossier-chat-v2/02-data/data-dictionary.csv lignes 2-53
-- cf. docs/dossier-chat-v2/02-data/migrations-plan.md
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_intent_centroid
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_intent_centroid" (
  "id" text PRIMARY KEY,
  "intent" text NOT NULL,
  "language" text NOT NULL DEFAULT 'all',
  "vector" vector(1536) NOT NULL,
  "sample_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chat_ic_language_check"
    CHECK ("language" IN ('all', 'fr', 'ar', 'ar-MA')),
  CONSTRAINT "chat_ic_sample_count_check" CHECK ("sample_count" >= 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chat_ic_intent_lang_idx"
  ON "chat_intent_centroid" ("intent", "language");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_ic_vector_hnsw_idx"
  ON "chat_intent_centroid"
  USING hnsw ("vector" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_intent_example
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_intent_example" (
  "id" text PRIMARY KEY,
  "intent" text NOT NULL,
  "language" text NOT NULL,
  "text" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chat_ie_language_check"
    CHECK ("language" IN ('fr', 'ar', 'ar-MA')),
  CONSTRAINT "chat_ie_text_len_check"
    CHECK (char_length("text") BETWEEN 5 AND 500)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_ie_intent_lang_idx"
  ON "chat_intent_example" ("intent", "language");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_ie_active_idx"
  ON "chat_intent_example" ("intent")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_canned_pair
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_canned_pair" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL,
  "page_pattern" text NOT NULL DEFAULT '*',
  "audience" text NOT NULL DEFAULT 'all',
  "order" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  "label_fr" text NOT NULL,
  "label_ar" text NOT NULL,
  "label_ar_ma" text NOT NULL,
  "scripted_reply_fr" text NOT NULL,
  "scripted_reply_ar" text NOT NULL,
  "scripted_reply_ar_ma" text NOT NULL,
  "cta_label" text,
  "cta_url" text,
  "allow_followup_llm" boolean NOT NULL DEFAULT true,
  "status" text NOT NULL DEFAULT 'draft',
  "current_version_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chat_cnp_audience_check"
    CHECK ("audience" IN ('all', 'b2c', 'b2b')),
  CONSTRAINT "chat_cnp_status_check"
    CHECK ("status" IN ('draft', 'review', 'published', 'archived')),
  CONSTRAINT "chat_cnp_label_fr_len" CHECK (char_length("label_fr") BETWEEN 5 AND 80),
  CONSTRAINT "chat_cnp_label_ar_len" CHECK (char_length("label_ar") BETWEEN 5 AND 80),
  CONSTRAINT "chat_cnp_label_ar_ma_len" CHECK (char_length("label_ar_ma") BETWEEN 5 AND 80),
  CONSTRAINT "chat_cnp_reply_fr_len" CHECK (char_length("scripted_reply_fr") BETWEEN 20 AND 600),
  CONSTRAINT "chat_cnp_reply_ar_len" CHECK (char_length("scripted_reply_ar") BETWEEN 20 AND 600),
  CONSTRAINT "chat_cnp_reply_ar_ma_len" CHECK (char_length("scripted_reply_ar_ma") BETWEEN 20 AND 600),
  CONSTRAINT "chat_cnp_cta_label_len" CHECK (
    "cta_label" IS NULL OR char_length("cta_label") BETWEEN 3 AND 60
  )
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chat_cnp_key_idx"
  ON "chat_canned_pair" ("key");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_cnp_published_idx"
  ON "chat_canned_pair" ("page_pattern", "audience", "order")
  WHERE "status" = 'published' AND "enabled" = true;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_canned_pair_version
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_canned_pair_version" (
  "id" text PRIMARY KEY,
  "pair_id" text NOT NULL,
  "body_fr" text NOT NULL,
  "body_ar" text NOT NULL,
  "body_ar_ma" text NOT NULL,
  "body_hash" text NOT NULL,
  "published_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_by" text NOT NULL,
  CONSTRAINT "chat_cnv_pair_fk"
    FOREIGN KEY ("pair_id") REFERENCES "chat_canned_pair"("id") ON DELETE CASCADE
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_cnv_pair_idx"
  ON "chat_canned_pair_version" ("pair_id", "published_at");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chat_cnv_pair_hash_idx"
  ON "chat_canned_pair_version" ("pair_id", "body_hash");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- chat_faq_entry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_faq_entry" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL,
  "language" text NOT NULL,
  "question_canonical" text NOT NULL,
  "question_embedding" vector(1536) NOT NULL,
  "scripted_reply" text NOT NULL,
  "intent_hint" text,
  "threshold" numeric NOT NULL DEFAULT 0.85,
  "enabled" boolean NOT NULL DEFAULT true,
  "audience" text NOT NULL DEFAULT 'all',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chat_fq_language_check"
    CHECK ("language" IN ('fr', 'ar', 'ar-MA')),
  CONSTRAINT "chat_fq_audience_check"
    CHECK ("audience" IN ('all', 'b2c', 'b2b')),
  CONSTRAINT "chat_fq_threshold_check"
    CHECK ("threshold" >= 0 AND "threshold" <= 1),
  CONSTRAINT "chat_fq_question_len"
    CHECK (char_length("question_canonical") BETWEEN 5 AND 300),
  CONSTRAINT "chat_fq_reply_len"
    CHECK (char_length("scripted_reply") BETWEEN 20 AND 800)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chat_fq_key_lang_idx"
  ON "chat_faq_entry" ("key", "language");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_fq_enabled_idx"
  ON "chat_faq_entry" ("language", "audience")
  WHERE "enabled" = true;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_fq_question_hnsw_idx"
  ON "chat_faq_entry"
  USING hnsw ("question_embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
