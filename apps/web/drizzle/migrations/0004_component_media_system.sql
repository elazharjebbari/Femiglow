CREATE TYPE "component_category" AS ENUM (
	'hero', 'section', 'card', 'gallery', 'carousel',
	'banner', 'form', 'media-block', 'cta'
);
--> statement-breakpoint
CREATE TYPE "animation_kind" AS ENUM ('none', 'framer-motion', 'css', 'svg');
--> statement-breakpoint
CREATE TYPE "placeholder_strategy" AS ENUM ('svg', 'blurhash', 'palette', 'none');
--> statement-breakpoint
CREATE TYPE "fetch_priority" AS ENUM ('high', 'low', 'auto');
--> statement-breakpoint
CREATE TABLE "site_components" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" "component_category" NOT NULL,
	"page_group" text NOT NULL,
	"file_path" text,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_svg_fallback" text,
	"default_loading_strategy" "media_loading_strategy" DEFAULT 'viewport' NOT NULL,
	"default_fetch_priority" "fetch_priority" DEFAULT 'auto' NOT NULL,
	"supports_animation" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_media_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"slot" text NOT NULL,
	"media_id" text,
	"loading_strategy" "media_loading_strategy" DEFAULT 'viewport' NOT NULL,
	"fetch_priority" "fetch_priority" DEFAULT 'auto' NOT NULL,
	"priority" boolean DEFAULT false NOT NULL,
	"placeholder_strategy" "placeholder_strategy" DEFAULT 'svg' NOT NULL,
	"custom_alt" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_animations" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" "animation_kind" NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"respects_reduced_motion" boolean DEFAULT true NOT NULL,
	"preview_snippet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_animation_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"animation_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_media_bindings" ADD CONSTRAINT "component_media_bindings_component_id_site_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."site_components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_media_bindings" ADD CONSTRAINT "component_media_bindings_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_media_bindings" ADD CONSTRAINT "component_media_bindings_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_animation_bindings" ADD CONSTRAINT "component_animation_bindings_component_id_site_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."site_components"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "component_animation_bindings" ADD CONSTRAINT "component_animation_bindings_animation_id_component_animations_id_fk" FOREIGN KEY ("animation_id") REFERENCES "public"."component_animations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "site_components_key_unique" ON "site_components" USING btree ("key");
--> statement-breakpoint
CREATE INDEX "site_components_page_group_idx" ON "site_components" USING btree ("page_group");
--> statement-breakpoint
CREATE INDEX "site_components_category_idx" ON "site_components" USING btree ("category");
--> statement-breakpoint
CREATE UNIQUE INDEX "component_media_bindings_component_slot_unique" ON "component_media_bindings" USING btree ("component_id", "slot");
--> statement-breakpoint
CREATE INDEX "component_media_bindings_media_idx" ON "component_media_bindings" USING btree ("media_id");
--> statement-breakpoint
CREATE INDEX "component_media_bindings_active_idx" ON "component_media_bindings" USING btree ("component_id", "is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX "component_animations_key_unique" ON "component_animations" USING btree ("key");
--> statement-breakpoint
CREATE UNIQUE INDEX "component_animation_bindings_unique" ON "component_animation_bindings" USING btree ("component_id", "animation_id");
--> statement-breakpoint
CREATE INDEX "component_animation_bindings_component_idx" ON "component_animation_bindings" USING btree ("component_id");
