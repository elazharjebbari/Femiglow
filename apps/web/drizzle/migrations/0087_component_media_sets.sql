-- Ne jamais rester bloqué derrière un verrou (ALTER TABLE media prend un ACCESS EXCLUSIVE) :
-- échec rapide et rollback complet plutôt qu'une file d'attente qui gèle le site.
-- SET LOCAL : portée = la transaction ouverte par _migrate-safe / drizzle-kit migrate.
SET LOCAL lock_timeout = '3s';
--> statement-breakpoint
CREATE TABLE "component_media_set_history" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"component_id" text NOT NULL,
	"slot" text NOT NULL,
	"variant_dim" text NOT NULL,
	"variant_key" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer NOT NULL,
	"items" jsonb NOT NULL,
	"cross_locale" boolean NOT NULL,
	"status" "field_binding_status" NOT NULL,
	"action" "field_history_action" NOT NULL,
	"actor_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_media_set_items" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"position" integer NOT NULL,
	"media_id" text NOT NULL,
	"mobile_media_id" text,
	"alt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"object_position" "media_object_position",
	"focal_x" integer,
	"focal_y" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_media_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL,
	"slot" text NOT NULL,
	"variant_dim" text DEFAULT 'default' NOT NULL,
	"variant_key" text DEFAULT '*' NOT NULL,
	"locale" text DEFAULT '*' NOT NULL,
	"cross_locale" boolean DEFAULT false NOT NULL,
	"status" "field_binding_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"source" text DEFAULT 'admin' NOT NULL,
	"notes" text,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "blur_data_url" text;--> statement-breakpoint
ALTER TABLE "component_media_set_history" ADD CONSTRAINT "component_media_set_history_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_media_set_items" ADD CONSTRAINT "component_media_set_items_set_id_component_media_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."component_media_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_media_set_items" ADD CONSTRAINT "component_media_set_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_media_set_items" ADD CONSTRAINT "component_media_set_items_mobile_media_id_media_id_fk" FOREIGN KEY ("mobile_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_media_sets" ADD CONSTRAINT "component_media_sets_component_id_site_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."site_components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_media_sets" ADD CONSTRAINT "component_media_sets_author_id_admin_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cmsh_set_idx" ON "component_media_set_history" USING btree ("set_id","created_at");--> statement-breakpoint
CREATE INDEX "cmsh_tuple" ON "component_media_set_history" USING btree ("component_id","slot","variant_dim","variant_key","locale","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_item_set_pos_uniq" ON "component_media_set_items" USING btree ("set_id","position");--> statement-breakpoint
CREATE INDEX "cms_item_media_idx" ON "component_media_set_items" USING btree ("media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_set_publish_uniq" ON "component_media_sets" USING btree ("component_id","slot","variant_dim","variant_key","locale") WHERE "component_media_sets"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "cms_set_draft_uniq" ON "component_media_sets" USING btree ("component_id","slot","variant_dim","variant_key","locale") WHERE "component_media_sets"."status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "cms_set_scheduled_uniq" ON "component_media_sets" USING btree ("component_id","slot","variant_dim","variant_key","locale") WHERE "component_media_sets"."status" = 'scheduled';--> statement-breakpoint
CREATE INDEX "cms_set_lookup" ON "component_media_sets" USING btree ("component_id","status");--> statement-breakpoint
CREATE INDEX "cms_set_scheduled" ON "component_media_sets" USING btree ("status","scheduled_at") WHERE "component_media_sets"."status" = 'scheduled';