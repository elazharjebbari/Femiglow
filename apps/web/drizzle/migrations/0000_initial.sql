CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'in_progress', 'succeeded', 'failed', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."lead_event_type" AS ENUM('created', 'status_changed', 'note_added', 'order_linked', 'webhook_dispatched');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost', 'archived');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"resource_type" text,
	"resource_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"type" "lead_event_type" NOT NULL,
	"actor_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source" text,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"shipping_mode" text NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint_id" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"response_status" integer,
	"response_body" text,
	"error_code" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"encrypted_secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "lead_events_lead_idx" ON "lead_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_events_created_at_idx" ON "lead_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_lead_idx" ON "orders" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_idempotency_unique" ON "webhook_deliveries" USING btree ("endpoint_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_next_attempt_idx" ON "webhook_deliveries" USING btree ("next_attempt_at");