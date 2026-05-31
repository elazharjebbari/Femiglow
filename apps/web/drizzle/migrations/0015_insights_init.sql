-- ===========================================================================
-- Migration 0015 — Analytics Insights : 6 tables d'agrégation pré-calculée
-- ---------------------------------------------------------------------------
-- INS-001 à INS-007 — cf. docs/analytics-insights/02-data.md
--
-- Objectif : extraire des KPIs et des visualisations sans scanner
-- `tracking_events_log` à chaque requête. Les agrégations sont rafraîchies
-- par cron (toutes les 15 min) ou manuellement.
--
-- Anonymisation par construction (count distinct, pas de PII brute).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "insights_event_daily" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "event_name" text NOT NULL,
  "event_category" text NOT NULL,
  "env" text NOT NULL,
  "device" text NOT NULL,
  "locale" text NOT NULL,
  "count" integer NOT NULL,
  "unique_sessions" integer NOT NULL,
  "conversion_count" integer NOT NULL DEFAULT 0,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "iev_unique"
  ON "insights_event_daily" ("date", "event_name", "env", "device", "locale");
CREATE INDEX IF NOT EXISTS "iev_date_idx"      ON "insights_event_daily" ("date");
CREATE INDEX IF NOT EXISTS "iev_event_idx"     ON "insights_event_daily" ("event_name", "date");
CREATE INDEX IF NOT EXISTS "iev_category_idx"  ON "insights_event_daily" ("event_category", "date");
CREATE INDEX IF NOT EXISTS "iev_env_idx"       ON "insights_event_daily" ("env", "date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights_page_daily" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "page_route" text NOT NULL,
  "page_views" integer NOT NULL DEFAULT 0,
  "unique_sessions" integer NOT NULL DEFAULT 0,
  "unique_visitors" integer NOT NULL DEFAULT 0,
  "events_total" integer NOT NULL DEFAULT 0,
  "scroll_75_count" integer NOT NULL DEFAULT 0,
  "conversions" integer NOT NULL DEFAULT 0,
  "bounce_count" integer NOT NULL DEFAULT 0,
  "avg_time_seconds" integer NOT NULL DEFAULT 0,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ipa_unique"   ON "insights_page_daily" ("date", "page_route");
CREATE INDEX IF NOT EXISTS "ipa_date_idx"        ON "insights_page_daily" ("date");
CREATE INDEX IF NOT EXISTS "ipa_route_idx"       ON "insights_page_daily" ("page_route", "date");
CREATE INDEX IF NOT EXISTS "ipa_pv_idx"          ON "insights_page_daily" ("page_views", "date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights_component_daily" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "component_id" text NOT NULL,
  "component_name" text,
  "page_route" text,
  "event_name" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "unique_sessions" integer NOT NULL DEFAULT 0,
  "conversion_count" integer NOT NULL DEFAULT 0,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ico_unique"
  ON "insights_component_daily" ("date", "component_id", "event_name", "page_route");
CREATE INDEX IF NOT EXISTS "ico_date_idx"      ON "insights_component_daily" ("date");
CREATE INDEX IF NOT EXISTS "ico_component_idx" ON "insights_component_daily" ("component_id", "date");
CREATE INDEX IF NOT EXISTS "ico_event_idx"     ON "insights_component_daily" ("event_name", "date");
CREATE INDEX IF NOT EXISTS "ico_count_idx"     ON "insights_component_daily" ("count", "date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights_section_daily" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "page_route" text NOT NULL,
  "section_id" text NOT NULL,
  "views" integer NOT NULL DEFAULT 0,
  "avg_dwell_seconds" integer NOT NULL DEFAULT 0,
  "unique_sessions" integer NOT NULL DEFAULT 0,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ise_unique"
  ON "insights_section_daily" ("date", "page_route", "section_id");
CREATE INDEX IF NOT EXISTS "ise_date_idx"   ON "insights_section_daily" ("date");
CREATE INDEX IF NOT EXISTS "ise_route_idx"  ON "insights_section_daily" ("page_route", "date");
CREATE INDEX IF NOT EXISTS "ise_dwell_idx"  ON "insights_section_daily" ("avg_dwell_seconds", "date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights_funnel_daily" (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "view_item" integer NOT NULL DEFAULT 0,
  "add_to_cart" integer NOT NULL DEFAULT 0,
  "begin_checkout" integer NOT NULL DEFAULT 0,
  "add_payment_info" integer NOT NULL DEFAULT 0,
  "purchase" integer NOT NULL DEFAULT 0,
  "generate_lead" integer NOT NULL DEFAULT 0,
  "unique_purchasers" integer NOT NULL DEFAULT 0,
  "revenue_total_cents" bigint NOT NULL DEFAULT 0,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ifu_date_unique" ON "insights_funnel_daily" ("date");
CREATE INDEX IF NOT EXISTS "ifu_date_idx"           ON "insights_funnel_daily" ("date");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights_refresh_run" (
  "id" text PRIMARY KEY,
  "trigger" text NOT NULL,
  "status" text NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "durations_ms" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error_code" text,
  "error_message" text,
  "triggered_by" text
);

CREATE INDEX IF NOT EXISTS "irf_started_idx" ON "insights_refresh_run" ("started_at");
CREATE INDEX IF NOT EXISTS "irf_status_idx"  ON "insights_refresh_run" ("status", "started_at");
