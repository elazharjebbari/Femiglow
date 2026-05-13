-- ===========================================================================
-- Migration 0035 — GTM Poka-Yoke : sentinel pings + drift state + history
-- ---------------------------------------------------------------------------
-- Tables ajoutées :
--   gtm_sentinel_pings             — pings reçus de GTM (rétention 90j)
--   gtm_drift_state                — état courant (1 ligne singleton)
--   gtm_drift_history              — append-only transitions de statut (1 an)
--   gtm_sentinel_daily_aggregates  — agrégat journalier (indéfini)
--
-- cf. docs/gtm-poka-yoke/20-data/02-migration.md
-- ===========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Table: gtm_sentinel_pings
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "gtm_sentinel_pings" (
    "id"                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    "received_at"               timestamptz   NOT NULL DEFAULT now(),
    "sent_at"                   timestamptz   NOT NULL,
    "container_id"              text          NOT NULL,
    "gtm_id"                    text,
    "bundle_id"                 text          NOT NULL,
    "mapping_version"           text          NOT NULL,
    "config_version"            text          NOT NULL,
    "manifest_mismatch"         boolean       NOT NULL DEFAULT false,
    "manifest_mismatch_details" text,
    "ua_hash"                   text,
    "ip_hash"                   text,
    "page_url_hash"             text,
    "raw_payload"               jsonb         NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS "idx_gtm_pings_received_at_desc"
    ON "gtm_sentinel_pings" ("received_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_gtm_pings_container_bundle"
    ON "gtm_sentinel_pings" ("container_id", "bundle_id");

CREATE INDEX IF NOT EXISTS "idx_gtm_pings_mapping_v_received"
    ON "gtm_sentinel_pings" ("mapping_version", "received_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- Table: gtm_drift_state (1 ligne singleton)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "gtm_drift_state" (
    "id"               text          PRIMARY KEY CHECK ("id" = 'singleton'),
    "status"           text          NOT NULL CHECK ("status" IN ('ok','warning','critical')),
    "since"            timestamptz   NOT NULL,
    "reasons_json"     jsonb         NOT NULL DEFAULT '[]'::jsonb,
    "last_ping_id"     uuid          REFERENCES "gtm_sentinel_pings"("id") ON DELETE SET NULL,
    "last_check_at"    timestamptz   NOT NULL DEFAULT now(),
    "admin_snapshot"   jsonb         NOT NULL DEFAULT '{}'::jsonb,
    "updated_at"       timestamptz   NOT NULL DEFAULT now()
);

-- Initial seed : status ok (sera recalculé au premier ping)
INSERT INTO "gtm_drift_state" (id, status, since, admin_snapshot)
VALUES ('singleton', 'ok', now(), '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- Table: gtm_drift_history (append-only)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "gtm_drift_history" (
    "id"                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    "at"                       timestamptz   NOT NULL DEFAULT now(),
    "previous_status"          text          CHECK ("previous_status" IS NULL OR "previous_status" IN ('ok','warning','critical')),
    "new_status"               text          NOT NULL CHECK ("new_status" IN ('ok','warning','critical')),
    "reasons_json"             jsonb         NOT NULL DEFAULT '[]'::jsonb,
    "triggered_by_ping_id"     uuid          REFERENCES "gtm_sentinel_pings"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_gtm_drift_history_at_desc"
    ON "gtm_drift_history" ("at" DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- Table: gtm_sentinel_daily_aggregates
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "gtm_sentinel_daily_aggregates" (
    "day"               date          NOT NULL,
    "bundle_id"         text          NOT NULL,
    "mapping_version"   text          NOT NULL,
    "config_version"    text          NOT NULL,
    "container_id"      text          NOT NULL,
    "pings_count"       integer       NOT NULL DEFAULT 0,
    "drift_detected"    boolean       NOT NULL DEFAULT false,
    "first_ping_at"     timestamptz   NOT NULL,
    "last_ping_at"      timestamptz   NOT NULL,
    PRIMARY KEY ("day", "bundle_id")
);

CREATE INDEX IF NOT EXISTS "idx_gtm_daily_agg_day_desc"
    ON "gtm_sentinel_daily_aggregates" ("day" DESC);
