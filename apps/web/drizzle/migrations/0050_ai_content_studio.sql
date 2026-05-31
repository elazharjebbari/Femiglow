CREATE TABLE IF NOT EXISTS "content_campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "objective" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_campaign_status_check" CHECK ("status" IN ('draft','active','archived'))
);

CREATE TABLE IF NOT EXISTS "content_idea" (
  "id" text PRIMARY KEY NOT NULL,
  "campaign_id" text REFERENCES "content_campaign"("id") ON DELETE SET NULL,
  "pillar" text NOT NULL,
  "objective" text NOT NULL,
  "platform" text NOT NULL,
  "format" text NOT NULL,
  "prompt" text NOT NULL,
  "source_type" text,
  "source_ref" text,
  "status" text DEFAULT 'idea' NOT NULL,
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_idea_status_check" CHECK ("status" IN ('idea','brief','generated','needs_review','approved','scheduled','published','failed','cancelled','rejected','archived','measured')),
  CONSTRAINT "content_idea_platform_check" CHECK ("platform" IN ('instagram','facebook')),
  CONSTRAINT "content_idea_format_check" CHECK ("format" IN ('post','story','reel','carousel'))
);

CREATE TABLE IF NOT EXISTS "content_brief" (
  "id" text PRIMARY KEY NOT NULL,
  "idea_id" text NOT NULL REFERENCES "content_idea"("id") ON DELETE CASCADE,
  "angle" text NOT NULL,
  "proof" text,
  "cta" text NOT NULL,
  "media_direction" text,
  "constraints_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_draft" (
  "id" text PRIMARY KEY NOT NULL,
  "brief_id" text NOT NULL REFERENCES "content_brief"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "format" text NOT NULL,
  "variant_label" text NOT NULL,
  "caption" text NOT NULL,
  "hook" text,
  "cta" text,
  "alt_text" text,
  "hashtags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'generated' NOT NULL,
  "score_total" integer,
  "edited_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_draft_status_check" CHECK ("status" IN ('generated','needs_review','approved','scheduled','published','failed','cancelled','rejected','archived','measured')),
  CONSTRAINT "content_draft_platform_check" CHECK ("platform" IN ('instagram','facebook')),
  CONSTRAINT "content_draft_format_check" CHECK ("format" IN ('post','story','reel','carousel'))
);

CREATE TABLE IF NOT EXISTS "content_asset_binding" (
  "id" text PRIMARY KEY NOT NULL,
  "draft_id" text NOT NULL REFERENCES "content_draft"("id") ON DELETE CASCADE,
  "media_id" text NOT NULL REFERENCES "media"("id") ON DELETE RESTRICT,
  "role" text DEFAULT 'primary' NOT NULL,
  "crop_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_generation_run" (
  "id" text PRIMARY KEY NOT NULL,
  "idea_id" text REFERENCES "content_idea"("id") ON DELETE SET NULL,
  "brief_id" text REFERENCES "content_brief"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "prompt_version" text NOT NULL,
  "input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'succeeded' NOT NULL,
  "cost_cents" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_brand_review" (
  "id" text PRIMARY KEY NOT NULL,
  "draft_id" text NOT NULL REFERENCES "content_draft"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "score_total" integer NOT NULL,
  "score_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "violations_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rules_version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_brand_review_status_check" CHECK ("status" IN ('pass','warning','blocked'))
);

CREATE TABLE IF NOT EXISTS "content_post" (
  "id" text PRIMARY KEY NOT NULL,
  "draft_id" text NOT NULL REFERENCES "content_draft"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'approved' NOT NULL,
  "scheduled_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "utm_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "approved_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_postiz_delivery" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL REFERENCES "content_post"("id") ON DELETE CASCADE,
  "integration_id" text NOT NULL,
  "postiz_post_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_performance_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL REFERENCES "content_post"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_learning_note" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text REFERENCES "content_post"("id") ON DELETE SET NULL,
  "note" text NOT NULL,
  "tags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "content_campaign_status_idx" ON "content_campaign" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "content_idea_status_idx" ON "content_idea" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "content_idea_pillar_idx" ON "content_idea" ("pillar", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "content_brief_idea_version_unique" ON "content_brief" ("idea_id", "version");
CREATE INDEX IF NOT EXISTS "content_draft_status_idx" ON "content_draft" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "content_draft_brief_idx" ON "content_draft" ("brief_id");
CREATE UNIQUE INDEX IF NOT EXISTS "content_asset_binding_draft_role_unique" ON "content_asset_binding" ("draft_id", "role");
CREATE INDEX IF NOT EXISTS "content_generation_run_idea_idx" ON "content_generation_run" ("idea_id", "created_at");
CREATE INDEX IF NOT EXISTS "content_brand_review_draft_idx" ON "content_brand_review" ("draft_id", "created_at");
CREATE INDEX IF NOT EXISTS "content_post_draft_idx" ON "content_post" ("draft_id");
CREATE INDEX IF NOT EXISTS "content_post_status_idx" ON "content_post" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "content_postiz_delivery_post_idx" ON "content_postiz_delivery" ("post_id");
CREATE INDEX IF NOT EXISTS "content_postiz_delivery_status_idx" ON "content_postiz_delivery" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "content_performance_post_captured_idx" ON "content_performance_snapshot" ("post_id", "captured_at");
