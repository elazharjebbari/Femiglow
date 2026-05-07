CREATE TYPE "public"."media_context" AS ENUM('hero', 'inline', 'thumb', 'og');--> statement-breakpoint
CREATE TYPE "public"."media_job_kind" AS ENUM('optimize', 'regenerate', 'phash', 'delete');--> statement-breakpoint
CREATE TYPE "public"."media_job_status" AS ENUM('pending', 'in_progress', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."media_loading_strategy" AS ENUM('eager', 'viewport', 'idle', 'interaction');--> statement-breakpoint
CREATE TYPE "public"."media_quality_profile" AS ENUM('hero', 'inline', 'thumb');--> statement-breakpoint
CREATE TYPE "public"."media_source" AS ENUM('upload', 'external');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'passthrough');--> statement-breakpoint
CREATE TYPE "public"."media_usage_type" AS ENUM('page', 'section', 'og', 'email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."variant_breakpoint" AS ENUM('xs', 'sm', 'md', 'lg', 'xl', '2xl');--> statement-breakpoint
CREATE TYPE "public"."variant_format" AS ENUM('avif', 'webp', 'jpeg', 'png', 'mp4', 'webm', 'mp3', 'opus', 'poster');--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "media_kind" NOT NULL,
	"source" "media_source" NOT NULL,
	"slug" text NOT NULL,
	"original_url" text,
	"original_filename" text,
	"original_size_bytes" bigint,
	"original_mime" text,
	"original_width" integer,
	"original_height" integer,
	"original_duration_ms" integer,
	"phash" text,
	"blurhash" text,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"credit" text,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"quality_profile" "media_quality_profile" DEFAULT 'inline' NOT NULL,
	"loading_strategy" "media_loading_strategy" DEFAULT 'viewport' NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"kind" "media_job_kind" NOT NULL,
	"status" "media_job_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_to_tags" (
	"media_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "media_to_tags_media_id_tag_id_pk" PRIMARY KEY("media_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"usage_type" "media_usage_type" NOT NULL,
	"route" text NOT NULL,
	"component" text NOT NULL,
	"context" "media_context" NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"format" "variant_format" NOT NULL,
	"breakpoint" "variant_breakpoint",
	"width" integer,
	"height" integer,
	"bitrate_kbps" integer,
	"quality" integer,
	"size_bytes" bigint NOT NULL,
	"url" text NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_to_tags" ADD CONSTRAINT "media_to_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_to_tags" ADD CONSTRAINT "media_to_tags_tag_id_media_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."media_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_slug_unique" ON "media" USING btree ("slug") WHERE "media"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "media_phash_idx" ON "media" USING btree ("phash") WHERE "media"."phash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "media_status_idx" ON "media" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "media_kind_idx" ON "media" USING btree ("kind","deleted_at");--> statement-breakpoint
CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_next_idx" ON "media_jobs" USING btree ("status","next_attempt_at") WHERE "media_jobs"."status" IN ('pending','in_progress');--> statement-breakpoint
CREATE INDEX "jobs_media_idx" ON "media_jobs" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tags_name_unique" ON "media_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "usages_media_idx" ON "media_usages" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "usages_route_idx" ON "media_usages" USING btree ("route");--> statement-breakpoint
CREATE UNIQUE INDEX "usages_unique" ON "media_usages" USING btree ("media_id","route","component");--> statement-breakpoint
CREATE INDEX "variants_media_idx" ON "media_variants" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_format_breakpoint_idx" ON "media_variants" USING btree ("media_id","format","breakpoint") WHERE "media_variants"."breakpoint" IS NOT NULL;