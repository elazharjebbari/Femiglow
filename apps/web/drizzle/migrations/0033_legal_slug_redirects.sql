-- ===========================================================================
-- Migration 0033 — Legal slug redirects
-- ---------------------------------------------------------------------------
-- Table de redirections pour préserver le SEO et les liens externes quand
-- un slug est renommé. /legal/<old_slug> → 301 /legal/<new_slug>.
-- Insertion manuelle (admin) ou auto (hook updateLegalPage si rename, V1.1).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "legal_slug_redirects" (
  "old_slug"   text PRIMARY KEY
    CHECK (old_slug ~ '^[a-z0-9-]+$' AND length(old_slug) BETWEEN 2 AND 80),
  "new_slug"   text NOT NULL
    CHECK (new_slug ~ '^[a-z0-9-]+$' AND length(new_slug) BETWEEN 2 AND 80),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  CHECK (old_slug <> new_slug)
);

CREATE INDEX IF NOT EXISTS "idx_legal_slug_redirects_new"
  ON "legal_slug_redirects" ("new_slug");
