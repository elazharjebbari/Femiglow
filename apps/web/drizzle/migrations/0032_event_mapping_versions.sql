-- ===========================================================================
-- Migration 0032 — Event mappings : table versioning principale
-- ---------------------------------------------------------------------------
-- Versionning des correspondances event_canonique → vendor (Meta/GA4/Ads/...).
-- Une seule version active à la fois (UNIQUE index conditionnel).
-- cf. docs/event-mappings/10-architecture/adr-001-versioning-strategy.md
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "event_mapping_versions" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "notes" text,
  "status" text NOT NULL CHECK (status IN ('draft','active','archived','deleted')),
  "is_active" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "mappings" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "cloned_from" text REFERENCES "event_mapping_versions"("id") ON DELETE SET NULL,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "activated_at" timestamptz,
  "archived_at" timestamptz,
  "deleted_at" timestamptz,
  CONSTRAINT "no_delete_default" CHECK (NOT (is_default = true AND status = 'deleted'))
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_mapping_versions_one_active"
  ON "event_mapping_versions" ("is_active") WHERE "is_active" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_versions_status_idx"
  ON "event_mapping_versions" ("status", "created_at" DESC);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "event_mapping_versions_default_idx"
  ON "event_mapping_versions" ("is_default") WHERE "is_default" = true;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_versions_mappings_gin"
  ON "event_mapping_versions" USING GIN ("mappings");
