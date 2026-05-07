CREATE TABLE "tracking_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_settings_key_unique" ON "tracking_settings" USING btree ("key");
