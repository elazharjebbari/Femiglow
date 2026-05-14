-- ===========================================================================
-- Migration 0029 — Legal pages (init)
-- ---------------------------------------------------------------------------
-- Crée l'enum legal_page_status, la table legal_pages (état courant), et la
-- table legal_pages_history (snapshots immuables par publication).
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE "legal_page_status" AS ENUM ('draft', 'review', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "legal_pages" (
  "id"                    text PRIMARY KEY,
  "slug"                  text NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) BETWEEN 2 AND 80),
  "title"                 text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  "description"           text CHECK (description IS NULL OR length(description) <= 200),
  "body_md"               text NOT NULL CHECK (length(body_md) >= 10),
  "status"                "legal_page_status" NOT NULL DEFAULT 'draft',
  "version"               integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  "include_in_search"     boolean NOT NULL DEFAULT FALSE,
  "canonical_url"         text,
  "locale"                text NOT NULL DEFAULT 'fr-MA' CHECK (locale IN ('fr-MA', 'ar-MA')),
  "require_legal_review"  boolean NOT NULL DEFAULT TRUE,
  "last_legal_review_at"  timestamp with time zone,
  "last_legal_review_by"  text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "submitted_at"          timestamp with time zone,
  "submitted_by"          text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "published_at"          timestamp with time zone,
  "published_by"          text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "created_by"            text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "updated_by"            text REFERENCES "admin_users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_legal_pages_status"
  ON "legal_pages" ("status")
  WHERE "status" IN ('published', 'review');

CREATE INDEX IF NOT EXISTS "idx_legal_pages_updated_at"
  ON "legal_pages" ("updated_at" DESC);


CREATE TABLE IF NOT EXISTS "legal_pages_history" (
  "id"                   text PRIMARY KEY,
  "page_id"              text NOT NULL REFERENCES "legal_pages"("id") ON DELETE CASCADE,
  "slug"                 text NOT NULL,
  "version"              integer NOT NULL CHECK (version >= 1),
  "title"                text NOT NULL,
  "description"          text,
  "body_md"              text NOT NULL,
  "metadata_json"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status_at_snapshot"   "legal_page_status" NOT NULL,
  "published_at"         timestamp with time zone NOT NULL,
  "published_by"         text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "git_commit_sha"       text,
  "git_commit_at"        timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("page_id", "version")
);

CREATE INDEX IF NOT EXISTS "idx_legal_history_page_version"
  ON "legal_pages_history" ("page_id", "version" DESC);

CREATE INDEX IF NOT EXISTS "idx_legal_history_slug_date"
  ON "legal_pages_history" ("slug", "published_at" DESC);

-- Trigger immuabilité (interdit UPDATE / DELETE — INSERT only)
CREATE OR REPLACE FUNCTION "legal_pages_history_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'legal_pages_history is immutable — INSERT only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_legal_history_no_update" ON "legal_pages_history";
CREATE TRIGGER "trg_legal_history_no_update"
  BEFORE UPDATE OR DELETE ON "legal_pages_history"
  FOR EACH ROW EXECUTE FUNCTION "legal_pages_history_immutable"();
