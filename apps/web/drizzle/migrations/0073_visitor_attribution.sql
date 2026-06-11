CREATE TABLE IF NOT EXISTS "visitor_attribution" (
	"visitor_id" text PRIMARY KEY NOT NULL,
	"first_touch" jsonb NOT NULL,
	"last_touch" jsonb NOT NULL,
	"paid_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_attribution_updated_at_idx" ON "visitor_attribution" USING btree ("updated_at");
