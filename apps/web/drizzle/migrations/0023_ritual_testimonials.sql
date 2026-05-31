-- ===========================================================================
-- Migration 0023 — Rituels partagés : tables, enums, agrégat
-- ---------------------------------------------------------------------------
-- Cf. docs/reviews-wall/execution/01-architecture-detaillee.md § 4
--    docs/reviews-wall/execution/04-backend-plan-action.md § 2
--    docs/reviews-wall/08-architecture-data.md
--
-- Périmètre :
--  - 3 tables : ritual_testimonials, ritual_testimonial_photos, ritual_audit_log
--  - 1 table d'agrégat (régulière, pas MV) refresh manuel par l'app
--  - 5 enums : ritual_signal, ritual_status, ritual_source, ritual_language,
--              ritual_photo_faces_status
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE "ritual_signal" AS ENUM ('oui', 'hesite', 'non');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ritual_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ritual_source" AS ENUM ('web', 'email_j45', 'manual', 'import_csv', 'import_json', 'import_zip');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ritual_language" AS ENUM ('fr', 'ar');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ritual_photo_faces_status" AS ENUM ('PENDING_CHECK', 'OK', 'MANUAL_REVIEW', 'REJECTED_FACE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ritual_testimonials" (
  "id" text PRIMARY KEY,
  "public_slug" text NOT NULL,
  "product_key" text NOT NULL,
  "body" text NOT NULL,
  "body_original" text,
  "would_recommend" "ritual_signal" NOT NULL,
  "ritual_tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "author_first_name" text,
  "author_city" text,
  "initiated_since" text,
  "is_anonymous" boolean NOT NULL DEFAULT false,
  "language" "ritual_language" NOT NULL DEFAULT 'fr',
  "status" "ritual_status" NOT NULL DEFAULT 'PENDING',
  "source" "ritual_source" NOT NULL,
  "customer_hash" text,
  "order_id" text,
  "verified_purchase" boolean NOT NULL DEFAULT false,
  "featured" boolean NOT NULL DEFAULT false,
  "moderation_note" text,
  "auto_flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "import_batch_id" text,
  "import_row_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "rt_public_slug_unique"
  ON "ritual_testimonials" ("public_slug");
CREATE INDEX IF NOT EXISTS "rt_status_product_idx"
  ON "ritual_testimonials" ("status", "product_key");
CREATE INDEX IF NOT EXISTS "rt_featured_idx"
  ON "ritual_testimonials" ("featured") WHERE "featured" = true;
CREATE INDEX IF NOT EXISTS "rt_published_at_idx"
  ON "ritual_testimonials" ("published_at" DESC) WHERE "status" = 'APPROVED';
CREATE INDEX IF NOT EXISTS "rt_customer_hash_idx"
  ON "ritual_testimonials" ("customer_hash");
CREATE INDEX IF NOT EXISTS "rt_import_batch_idx"
  ON "ritual_testimonials" ("import_batch_id") WHERE "import_batch_id" IS NOT NULL;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ritual_testimonial_photos" (
  "id" text PRIMARY KEY,
  "testimonial_id" text NOT NULL REFERENCES "ritual_testimonials"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "thumb_url" text NOT NULL,
  "focal_x" numeric(4,3) NOT NULL DEFAULT 0.500,
  "focal_y" numeric(4,3) NOT NULL DEFAULT 0.500,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "byte_size" integer NOT NULL,
  "mime" text NOT NULL,
  "alt" text,
  "faces_status" "ritual_photo_faces_status" NOT NULL DEFAULT 'PENDING_CHECK',
  "faces_count" integer NOT NULL DEFAULT 0,
  "faces_check_at" timestamp with time zone,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rtp_testimonial_idx"
  ON "ritual_testimonial_photos" ("testimonial_id", "position");
CREATE INDEX IF NOT EXISTS "rtp_faces_pending_idx"
  ON "ritual_testimonial_photos" ("faces_status")
  WHERE "faces_status" IN ('PENDING_CHECK', 'MANUAL_REVIEW');

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ritual_audit_log" (
  "id" text PRIMARY KEY,
  "testimonial_id" text REFERENCES "ritual_testimonials"("id") ON DELETE CASCADE,
  "actor_id" text,
  "action" text NOT NULL,
  "note" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ral_testimonial_idx"
  ON "ritual_audit_log" ("testimonial_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ral_actor_idx"
  ON "ritual_audit_log" ("actor_id", "created_at" DESC);

--> statement-breakpoint

-- ritual_aggregate : table régulière (pas MV) pour cohérence dual-driver
-- (Drizzle + memory store). Refresh manuel via service.
CREATE TABLE IF NOT EXISTS "ritual_aggregate" (
  "product_key" text PRIMARY KEY,
  "total_count" integer NOT NULL DEFAULT 0,
  "oui_count" integer NOT NULL DEFAULT 0,
  "hesite_count" integer NOT NULL DEFAULT 0,
  "non_count" integer NOT NULL DEFAULT 0,
  "with_photos_count" integer NOT NULL DEFAULT 0,
  "top_tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "last_published_at" timestamp with time zone,
  "refreshed_at" timestamp with time zone NOT NULL DEFAULT now()
);
