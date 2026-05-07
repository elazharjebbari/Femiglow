CREATE TYPE "public"."tracking_component_category" AS ENUM('cta_primary', 'cta_secondary', 'cta_ghost', 'navigation', 'form_input', 'form_submit', 'media_image', 'media_video', 'media_audio', 'list_item', 'card', 'pricing', 'filter', 'search', 'social_share', 'newsletter', 'modal', 'accordion', 'tab', 'carousel', 'progress', 'banner', 'section_hero', 'section_content', 'section_testimonial', 'section_faq', 'commerce_cart', 'commerce_checkout', 'admin');--> statement-breakpoint
CREATE TYPE "public"."tracking_consent_state" AS ENUM('granted', 'denied', 'pending');--> statement-breakpoint
CREATE TYPE "public"."tracking_event_category" AS ENUM('page', 'engagement', 'ecommerce', 'lead', 'media', 'admin', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tracking_event_scope" AS ENUM('web', 'server', 'both');--> statement-breakpoint
CREATE TYPE "public"."tracking_provider_kind" AS ENUM('meta', 'tiktok', 'google_ads', 'google_ga4', 'snap', 'pinterest', 'gtm', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tracking_provider_status" AS ENUM('disabled', 'enabled', 'error');--> statement-breakpoint
CREATE TABLE "tracking_component_events" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"event_definition_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"params_override" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"providers_override" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_components" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"category" "tracking_component_category" NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"default_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tracking_consent_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"anonymous_id" text NOT NULL,
	"state" jsonb NOT NULL,
	"state_hash" text NOT NULL,
	"source" text NOT NULL,
	"ip_anonymized" text NOT NULL,
	"ua_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_event_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "tracking_event_category" NOT NULL,
	"scope" "tracking_event_scope" DEFAULT 'web' NOT NULL,
	"description" text NOT NULL,
	"is_conversion" boolean DEFAULT false NOT NULL,
	"params_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applicable_categories" "tracking_component_category"[] DEFAULT ARRAY[]::tracking_component_category[] NOT NULL,
	"default_providers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events_log" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"event_category" "tracking_event_category" NOT NULL,
	"page_id" text,
	"component_id" text,
	"page_route" text NOT NULL,
	"anonymous_id" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text,
	"consent_snapshot" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"ua_hash" text NOT NULL,
	"ip_anonymized" text NOT NULL,
	"device" text NOT NULL,
	"locale" text NOT NULL,
	"is_conversion" boolean DEFAULT false NOT NULL,
	"providers_dispatched" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"providers_results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_pages_components" (
	"page_id" text NOT NULL,
	"component_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tracking_pages_components_page_id_component_id_pk" PRIMARY KEY("page_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "tracking_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "tracking_provider_kind" NOT NULL,
	"status" "tracking_provider_status" DEFAULT 'disabled' NOT NULL,
	"pixel_id" text,
	"capi_token" text,
	"capi_token_iv" text,
	"capi_token_tag" text,
	"test_event_code" text,
	"custom_head" text,
	"custom_body" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_events" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_event_at" timestamp with time zone,
	"error_count_24h" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_component_events" ADD CONSTRAINT "tracking_component_events_component_id_tracking_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."tracking_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_component_events" ADD CONSTRAINT "tracking_component_events_event_definition_id_tracking_event_definitions_id_fk" FOREIGN KEY ("event_definition_id") REFERENCES "public"."tracking_event_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events_log" ADD CONSTRAINT "tracking_events_log_page_id_tracking_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."tracking_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events_log" ADD CONSTRAINT "tracking_events_log_component_id_tracking_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."tracking_components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_pages_components" ADD CONSTRAINT "tracking_pages_components_page_id_tracking_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."tracking_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_pages_components" ADD CONSTRAINT "tracking_pages_components_component_id_tracking_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."tracking_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_ce_unique" ON "tracking_component_events" USING btree ("component_id","event_definition_id");--> statement-breakpoint
CREATE INDEX "tracking_ce_comp_idx" ON "tracking_component_events" USING btree ("component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_components_path_unique" ON "tracking_components" USING btree ("path");--> statement-breakpoint
CREATE INDEX "tracking_components_category_idx" ON "tracking_components" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tracking_consent_anonymous_idx" ON "tracking_consent_snapshots" USING btree ("anonymous_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_consent_anonymous_state_unique" ON "tracking_consent_snapshots" USING btree ("anonymous_id","state_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_event_def_name_unique" ON "tracking_event_definitions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tracking_event_def_category_idx" ON "tracking_event_definitions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_events_log_event_id_unique" ON "tracking_events_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tracking_events_log_name_idx" ON "tracking_events_log" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "tracking_events_log_received_at_idx" ON "tracking_events_log" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "tracking_events_log_anonymous_idx" ON "tracking_events_log" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "tracking_events_log_session_idx" ON "tracking_events_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "tracking_events_log_conversion_idx" ON "tracking_events_log" USING btree ("is_conversion") WHERE is_conversion = true;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_pages_route_unique" ON "tracking_pages" USING btree ("route");--> statement-breakpoint
CREATE INDEX "tracking_pages_category_idx" ON "tracking_pages" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tracking_pc_page_idx" ON "tracking_pages_components" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "tracking_pc_comp_idx" ON "tracking_pages_components" USING btree ("component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_providers_kind_unique" ON "tracking_providers" USING btree ("kind");