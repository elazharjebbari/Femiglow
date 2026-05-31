-- Social publishing data model for direct publishing from Femiglow.
CREATE TABLE IF NOT EXISTS "social_account" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "platform" text NOT NULL,
  "remote_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "capabilities_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "social_account_provider_check" CHECK ("provider" IN ('dry_run','meta_graph','postiz')),
  CONSTRAINT "social_account_platform_check" CHECK ("platform" IN ('instagram','facebook')),
  CONSTRAINT "social_account_status_check" CHECK ("status" IN ('active','disabled','token_expired','permission_missing'))
);

CREATE TABLE IF NOT EXISTS "social_credential" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL REFERENCES "social_account"("id") ON DELETE CASCADE,
  "secret_ref" text NOT NULL,
  "scopes_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamptz,
  "rotated_at" timestamptz,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "social_publish_job" (
  "id" text PRIMARY KEY NOT NULL,
  "post_id" text NOT NULL REFERENCES "content_post"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL REFERENCES "social_account"("id") ON DELETE RESTRICT,
  "provider" text NOT NULL,
  "platform" text NOT NULL,
  "format" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "idempotency_key" text NOT NULL,
  "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scheduled_at" timestamptz,
  "published_at" timestamptz,
  "locked_at" timestamptz,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_error_json" jsonb,
  "requested_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "social_publish_job_provider_check" CHECK ("provider" IN ('dry_run','meta_graph','postiz')),
  CONSTRAINT "social_publish_job_platform_check" CHECK ("platform" IN ('instagram','facebook')),
  CONSTRAINT "social_publish_job_format_check" CHECK ("format" IN ('post','story','reel','carousel')),
  CONSTRAINT "social_publish_job_status_check" CHECK ("status" IN ('draft','approved','queued','publishing','published','failed','cancelled'))
);

CREATE TABLE IF NOT EXISTS "social_publish_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL REFERENCES "social_publish_job"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "provider" text NOT NULL,
  "status" text NOT NULL,
  "request_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "response_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_json" jsonb,
  "duration_ms" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "social_publish_attempt_provider_check" CHECK ("provider" IN ('dry_run','meta_graph','postiz')),
  CONSTRAINT "social_publish_attempt_status_check" CHECK ("status" IN ('succeeded','failed'))
);

CREATE TABLE IF NOT EXISTS "social_publication" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL REFERENCES "social_publish_job"("id") ON DELETE CASCADE,
  "post_id" text NOT NULL REFERENCES "content_post"("id") ON DELETE CASCADE,
  "account_id" text NOT NULL REFERENCES "social_account"("id") ON DELETE RESTRICT,
  "provider" text NOT NULL,
  "platform" text NOT NULL,
  "remote_id" text NOT NULL,
  "permalink" text,
  "status" text DEFAULT 'published' NOT NULL,
  "published_at" timestamptz NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "social_publication_provider_check" CHECK ("provider" IN ('dry_run','meta_graph','postiz')),
  CONSTRAINT "social_publication_platform_check" CHECK ("platform" IN ('instagram','facebook')),
  CONSTRAINT "social_publication_status_check" CHECK ("status" IN ('published','removed','unknown'))
);

CREATE TABLE IF NOT EXISTS "social_publish_event" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL REFERENCES "social_publish_job"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "actor_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "message" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "social_account_provider_platform_idx" ON "social_account" ("provider", "platform");
CREATE UNIQUE INDEX IF NOT EXISTS "social_account_provider_remote_unique" ON "social_account" ("provider", "remote_id");
CREATE INDEX IF NOT EXISTS "social_account_status_idx" ON "social_account" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "social_credential_account_idx" ON "social_credential" ("account_id");
CREATE INDEX IF NOT EXISTS "social_credential_expires_idx" ON "social_credential" ("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "social_publish_job_idempotency_unique" ON "social_publish_job" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "social_publish_job_post_idx" ON "social_publish_job" ("post_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_publish_job_account_status_idx" ON "social_publish_job" ("account_id", "status");
CREATE INDEX IF NOT EXISTS "social_publish_job_status_scheduled_idx" ON "social_publish_job" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "social_publish_attempt_job_idx" ON "social_publish_attempt" ("job_id", "attempt_number");
CREATE UNIQUE INDEX IF NOT EXISTS "social_publication_job_unique" ON "social_publication" ("job_id");
CREATE UNIQUE INDEX IF NOT EXISTS "social_publication_provider_remote_unique" ON "social_publication" ("provider", "remote_id");
CREATE INDEX IF NOT EXISTS "social_publication_post_idx" ON "social_publication" ("post_id", "created_at");
CREATE INDEX IF NOT EXISTS "social_publish_event_job_idx" ON "social_publish_event" ("job_id", "created_at");
