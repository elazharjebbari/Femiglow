-- 0028_emailing — idempotent migration adding 10 email_* tables,
-- their enums, indexes and FK constraints.
-- All wrapped with IF NOT EXISTS / DO duplicate_object guards.
-- Cf. docs/emailing/02-data-model.md §4.

DO $$ BEGIN
  CREATE TYPE "public"."email_audience_optin" AS ENUM('single', 'double');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_audience_type" AS ENUM('public', 'private');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_automation_run_status" AS ENUM('running', 'completed', 'cancelled', 'errored');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_automation_trigger_type" AS ENUM('event', 'schedule', 'subscription', 'webhook');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_bounce_type" AS ENUM('soft', 'hard', 'complaint', 'unsubscribe');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_campaign_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_event_source" AS ENUM('stalwart', 'listmonk', 'app');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_event_type" AS ENUM('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced_soft', 'bounced_hard', 'complaint', 'unsubscribed', 'failed', 'retried', 'suppressed', 'dlq');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_outbox_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced_soft', 'bounced_permanent', 'suppressed', 'dlq');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_subscriber_status" AS ENUM('pending', 'enabled', 'disabled', 'blocklisted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_suppression_reason" AS ENUM('hard_bounce', 'soft_bounce_repeated', 'complaint', 'unsubscribe', 'manual_admin', 'cndp_request', 'invalid_format');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_suppression_source" AS ENUM('stalwart', 'listmonk', 'manual', 'cndp');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_template_category" AS ENUM('transactional', 'broadcast', 'automation');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_audience_link" (
	"id" text PRIMARY KEY NOT NULL,
	"listmonk_list_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" "email_audience_type" NOT NULL,
	"optin_mode" "email_audience_optin" DEFAULT 'double' NOT NULL,
	"segment_rules" jsonb,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_automation" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"trigger_type" "email_automation_trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_automation_run" (
	"id" text PRIMARY KEY NOT NULL,
	"automation_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" "email_automation_run_status" DEFAULT 'running' NOT NULL,
	"context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"next_action_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"outbox_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_campaign_link" (
	"id" text PRIMARY KEY NOT NULL,
	"listmonk_campaign_id" integer,
	"status" "email_campaign_status" DEFAULT 'draft' NOT NULL,
	"name" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"preheader" text,
	"template_slug" text,
	"audience_link_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"bounce_count" integer DEFAULT 0 NOT NULL,
	"unsubscribe_count" integer DEFAULT 0 NOT NULL,
	"ab_variant" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"outbox_id" text,
	"campaign_id" text,
	"subscriber_id" text,
	"type" "email_event_type" NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "email_event_source" NOT NULL,
	"raw_json" jsonb,
	"ip" text,
	"user_agent" text,
	"link_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"template" text NOT NULL,
	"template_version" integer NOT NULL,
	"to_email" text NOT NULL,
	"to_name" text,
	"from_email" text NOT NULL,
	"reply_to" text,
	"subject" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"html_snapshot" text,
	"text_snapshot" text,
	"status" "email_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_retry" timestamp with time zone,
	"last_error" text,
	"smtp_message_id" text,
	"smtp_response" text,
	"queue_id" text,
	"scheduled_for" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"bounce_reason" text,
	"bounce_type" "email_bounce_type",
	"source" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_subscriber_link" (
	"email" text PRIMARY KEY NOT NULL,
	"listmonk_subscriber_id" integer,
	"user_id" text,
	"first_name" text,
	"consent_at" timestamp with time zone,
	"consent_source" text,
	"double_optin_confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"status" "email_subscriber_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_suppression" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" "email_suppression_reason" NOT NULL,
	"detail" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "email_suppression_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_template_meta" (
	"slug" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"category" "email_template_category" NOT NULL,
	"description" text,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"listmonk_template_id" integer,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_automation_run" ADD CONSTRAINT "email_automation_run_automation_id_email_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."email_automation"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_campaign_link" ADD CONSTRAINT "email_campaign_link_template_slug_email_template_meta_slug_fk" FOREIGN KEY ("template_slug") REFERENCES "public"."email_template_meta"("slug") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "email_event" ADD CONSTRAINT "email_event_outbox_id_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_audience_link_lm_id_unique" ON "email_audience_link" USING btree ("listmonk_list_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_automation_slug_unique" ON "email_automation" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_automation_active_idx" ON "email_automation" USING btree ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_automation_run_automation_idx" ON "email_automation_run" USING btree ("automation_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_automation_run_next_action_idx" ON "email_automation_run" USING btree ("next_action_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_automation_run_email_idx" ON "email_automation_run" USING btree ("recipient_email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_campaign_link_lm_unique" ON "email_campaign_link" USING btree ("listmonk_campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_campaign_link_status_idx" ON "email_campaign_link" USING btree ("status","scheduled_for");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_campaign_link_created_at_idx" ON "email_campaign_link" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_event_outbox_idx" ON "email_event" USING btree ("outbox_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_event_campaign_idx" ON "email_event" USING btree ("campaign_id","ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_event_ts_idx" ON "email_event" USING btree ("ts");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_event_type_idx" ON "email_event" USING btree ("type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_idem_unique" ON "email_outbox" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_status_idx" ON "email_outbox" USING btree ("status","next_retry");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_to_email_idx" ON "email_outbox" USING btree ("to_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_created_at_idx" ON "email_outbox" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_template_idx" ON "email_outbox" USING btree ("template");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_smtp_message_id_idx" ON "email_outbox" USING btree ("smtp_message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_subscriber_link_lm_unique" ON "email_subscriber_link" USING btree ("listmonk_subscriber_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_subscriber_link_status_idx" ON "email_subscriber_link" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_suppression_since_idx" ON "email_suppression" USING btree ("since");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_suppression_reason_idx" ON "email_suppression" USING btree ("reason");
--> statement-breakpoint
