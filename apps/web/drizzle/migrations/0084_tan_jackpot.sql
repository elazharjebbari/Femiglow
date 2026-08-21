CREATE TABLE "media_story" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"page_group" text DEFAULT 'kit' NOT NULL,
	"title_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bubble_poster_url" text NOT NULL,
	"bubble_media_id" text,
	"accent" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_story_segment" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"media_id" text,
	"video_url" text NOT NULL,
	"webm_url" text,
	"poster_url" text NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"caption_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cta_label_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cta_target" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_story" ADD CONSTRAINT "media_story_bubble_media_id_media_id_fk" FOREIGN KEY ("bubble_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_story_segment" ADD CONSTRAINT "media_story_segment_story_id_media_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."media_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_story_segment" ADD CONSTRAINT "media_story_segment_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_story_slug_unique" ON "media_story" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "media_story_active_order_idx" ON "media_story" USING btree ("page_group","is_active","display_order");--> statement-breakpoint
CREATE INDEX "media_story_segment_story_order_idx" ON "media_story_segment" USING btree ("story_id","is_active","display_order");