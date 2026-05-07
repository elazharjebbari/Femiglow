-- SEO-CMS — overrides, settings, audit snapshots
-- cf. docs/seo-cms/architecture/02-data-model.md

CREATE TYPE "seo_scope" AS ENUM ('page', 'component', 'product', 'article');
--> statement-breakpoint
CREATE TYPE "og_image_template" AS ENUM ('marketing', 'article', 'product', 'default');
--> statement-breakpoint
CREATE TYPE "twitter_card_type" AS ENUM ('summary', 'summary_large_image');
--> statement-breakpoint
CREATE TABLE "seo_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "seo_scope" NOT NULL,
	"target_key" text NOT NULL,
	"locale" text NOT NULL DEFAULT 'fr-MA',
	"title" text,
	"description" text,
	"keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"og_title" text,
	"og_description" text,
	"og_image_media_id" text REFERENCES "media"("id") ON DELETE SET NULL,
	"og_image_template" "og_image_template",
	"twitter_card" "twitter_card_type" NOT NULL DEFAULT 'summary_large_image',
	"canonical" text,
	"robots_index" boolean NOT NULL DEFAULT true,
	"robots_follow" boolean NOT NULL DEFAULT true,
	"structured_data" jsonb,
	"published_at" timestamp with time zone,
	"drafted_at" timestamp with time zone NOT NULL DEFAULT now(),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "seo_overrides_target_unique" ON "seo_overrides"
	("scope", "target_key", "locale");
--> statement-breakpoint
CREATE INDEX "seo_overrides_published_idx" ON "seo_overrides"
	("published_at" DESC);
--> statement-breakpoint
CREATE INDEX "seo_overrides_scope_idx" ON "seo_overrides" ("scope");
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"site_name" text NOT NULL DEFAULT 'FemiGlow',
	"default_description" text,
	"default_og_image_media_id" text REFERENCES "media"("id") ON DELETE SET NULL,
	"twitter_handle" text,
	"organization_json_ld" jsonb,
	"default_robots_index" boolean NOT NULL DEFAULT true,
	"default_robots_follow" boolean NOT NULL DEFAULT true,
	"known_pages" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
	CONSTRAINT "seo_settings_singleton" CHECK ("id" = 'singleton')
);
--> statement-breakpoint
CREATE TABLE "seo_audit_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" "seo_scope" NOT NULL,
	"target_key" text NOT NULL,
	"locale" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL DEFAULT now(),
	"payload" jsonb NOT NULL,
	"actor_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "seo_audit_snapshots_target_idx" ON "seo_audit_snapshots"
	("scope", "target_key", "locale", "captured_at" DESC);
