-- Admin-Config — configuration centralisée (NAV, flags, RBAC, branding)
-- cf. docs/admin-config/architecture/02-data-model.md

CREATE TABLE "app_config" (
	"section" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"version" integer NOT NULL DEFAULT 1,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE "app_config_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"section" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer NOT NULL,
	"actor_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
	"note" text,
	"captured_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "acs_section_captured_idx" ON "app_config_snapshots"
	("section", "captured_at" DESC);
--> statement-breakpoint
CREATE INDEX "acs_actor_idx" ON "app_config_snapshots"
	("actor_id");
