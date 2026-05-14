-- ===========================================================================
-- Migration 0032 — Legal link health snapshot
-- ---------------------------------------------------------------------------
-- Snapshot du résultat des vérifications quotidiennes de liens (placement →
-- page → HTTP). Le cron rote les 30 derniers snapshots et purge au-delà.
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE "legal_link_status" AS ENUM (
    'ok', 'page_missing', 'page_draft',
    'http_4xx', 'http_5xx', 'timeout'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "legal_link_health_snapshot" (
  "id"          text PRIMARY KEY,
  "checked_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "zone_key"    text NOT NULL,
  "page_slug"   text NOT NULL,
  "status"      "legal_link_status" NOT NULL,
  "http_code"   integer CHECK (http_code IS NULL OR http_code BETWEEN 100 AND 599),
  "latency_ms"  integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  "notes"       text
);

CREATE INDEX IF NOT EXISTS "idx_lhs_checked_at"
  ON "legal_link_health_snapshot" ("checked_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_lhs_link"
  ON "legal_link_health_snapshot" ("zone_key", "page_slug", "checked_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_lhs_anomaly"
  ON "legal_link_health_snapshot" ("status")
  WHERE "status" <> 'ok';
