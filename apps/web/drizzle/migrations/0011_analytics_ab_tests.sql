-- Migration 0011 : analytics — schémas A/B testing (anticipation V2)
-- cf. docs/analytics/02-data-model.md §5
-- Tables vides en V1 ; alimentées par UI dédiée en V2. Présentes dès maintenant
-- pour éviter une migration breaking ultérieure : les events peuvent déjà
-- référencer experiment_id / experiment_variant.

DO $$ BEGIN
  CREATE TYPE "experiment_status" AS ENUM ('draft','running','paused','completed','archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "experiments" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "hypothesis" text,
  "status" "experiment_status" NOT NULL DEFAULT 'draft',
  "primary_metric" text NOT NULL,
  "secondary_metrics" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "audience_filter" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "experiments_status_idx" ON "experiments" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "experiment_variants" (
  "id" text PRIMARY KEY,
  "experiment_id" text NOT NULL REFERENCES "experiments"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "is_control" boolean NOT NULL DEFAULT false,
  "weight" integer NOT NULL DEFAULT 50 CHECK ("weight" >= 0 AND "weight" <= 100),
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "experiment_variants_exp_key_idx"
  ON "experiment_variants" ("experiment_id", "key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "experiment_assignments" (
  "id" text PRIMARY KEY,
  "experiment_id" text NOT NULL REFERENCES "experiments"("id") ON DELETE CASCADE,
  "variant_id" text NOT NULL REFERENCES "experiment_variants"("id") ON DELETE CASCADE,
  "anonymous_id" text NOT NULL,
  "user_id" text,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  "context" jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "experiment_assignments_exp_anon_idx"
  ON "experiment_assignments" ("experiment_id", "anonymous_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "experiment_assignments_variant_idx"
  ON "experiment_assignments" ("variant_id");
