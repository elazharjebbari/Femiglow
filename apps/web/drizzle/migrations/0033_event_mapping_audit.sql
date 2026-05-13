-- ===========================================================================
-- Migration 0033 — Event mappings : audit log structuré
-- ---------------------------------------------------------------------------
-- Conserve l'historique complet (qui, quoi, quand, before/after) des mutations
-- sur event_mapping_versions. Conservé indéfiniment.
-- cf. docs/event-mappings/30-backend/audit-events.md
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "event_mapping_audit" (
  "id" text PRIMARY KEY,
  "version_id" text REFERENCES "event_mapping_versions"("id") ON DELETE SET NULL,
  "action" text NOT NULL CHECK (action IN (
    'create','edit','activate','archive','delete',
    'restore','duplicate','reset_to_default',
    'export_gtm','test_event'
  )),
  "actor_id" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_anonymized" text,
  "ua_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_version_idx"
  ON "event_mapping_audit" ("version_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_actor_idx"
  ON "event_mapping_audit" ("actor_id", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "event_mapping_audit_action_idx"
  ON "event_mapping_audit" ("action", "created_at" DESC);
