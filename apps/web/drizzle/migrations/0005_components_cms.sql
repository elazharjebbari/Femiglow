-- Components-CMS — champs éditoriaux typés
-- cf. docs/components-cms/architecture/02-data-model.md

CREATE TYPE "field_binding_status" AS ENUM (
	'draft', 'published', 'scheduled', 'archived'
);
--> statement-breakpoint
CREATE TYPE "field_history_action" AS ENUM (
	'create', 'update', 'publish', 'unpublish',
	'restore', 'archive', 'schedule', 'unschedule'
);
--> statement-breakpoint
ALTER TABLE "site_components"
	ADD COLUMN "fields" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "component_field_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"component_id" text NOT NULL REFERENCES "site_components"("id") ON DELETE CASCADE,
	"field_key" text NOT NULL,
	"locale" text NOT NULL DEFAULT 'fr',
	"value" jsonb NOT NULL,
	"status" "field_binding_status" NOT NULL DEFAULT 'draft',
	"version" integer NOT NULL DEFAULT 1,
	"published_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"notes" text,
	"author_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cfb_scheduled_requires_scheduled_at" CHECK (
		"status" <> 'scheduled' OR "scheduled_at" IS NOT NULL
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cfb_publish_uniq" ON "component_field_bindings"
	("component_id", "field_key", "locale")
	WHERE "status" = 'published';
--> statement-breakpoint
CREATE UNIQUE INDEX "cfb_draft_uniq" ON "component_field_bindings"
	("component_id", "field_key", "locale")
	WHERE "status" = 'draft';
--> statement-breakpoint
CREATE INDEX "cfb_lookup" ON "component_field_bindings"
	("component_id", "field_key", "locale", "status");
--> statement-breakpoint
CREATE INDEX "cfb_scheduled" ON "component_field_bindings"
	("status", "scheduled_at")
	WHERE "status" = 'scheduled';
--> statement-breakpoint
CREATE TABLE "component_field_history" (
	"id" text PRIMARY KEY NOT NULL,
	"binding_id" text NOT NULL REFERENCES "component_field_bindings"("id") ON DELETE CASCADE,
	"component_id" text NOT NULL,
	"field_key" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"status" "field_binding_status" NOT NULL,
	"actor_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"action" "field_history_action" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cfh_binding_idx" ON "component_field_history"
	("binding_id", "created_at");
--> statement-breakpoint
CREATE INDEX "cfh_triplet" ON "component_field_history"
	("component_id", "field_key", "locale", "created_at");
--> statement-breakpoint
CREATE INDEX "cfh_created_at_idx" ON "component_field_history"
	("created_at");
