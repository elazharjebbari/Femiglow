-- Migration 0008 : products-cms
-- Tables : products, product_variants, product_snapshots
-- cf. docs/products-cms/architecture/02-data-model.md

CREATE TYPE "product_status" AS ENUM ('draft', 'published', 'archived');
--> statement-breakpoint
CREATE TYPE "inventory_status" AS ENUM ('available', 'low_stock', 'out_of_stock', 'preorder');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "status" "product_status" NOT NULL DEFAULT 'draft',
  "title" text NOT NULL,
  "tagline" text,
  "description" text,
  "category" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "position" integer NOT NULL DEFAULT 0,
  "featured" boolean NOT NULL DEFAULT false,
  "published_at" timestamptz,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" text REFERENCES "admin_users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_status_published_at_idx"
  ON "products" ("status", "published_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" text PRIMARY KEY,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku" text NOT NULL,
  "label" text NOT NULL,
  "price_cents" integer NOT NULL CHECK ("price_cents" > 0),
  "promo_price_cents" integer CHECK ("promo_price_cents" IS NULL OR "promo_price_cents" > 0),
  "currency" text NOT NULL DEFAULT 'EUR',
  "inventory_status" "inventory_status" NOT NULL DEFAULT 'available',
  "weight_g" integer,
  "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_variants_promo_lt_price"
    CHECK ("promo_price_cents" IS NULL OR "promo_price_cents" < "price_cents")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_sku_idx"
  ON "product_variants" ("product_id", "sku");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_position_idx"
  ON "product_variants" ("product_id", "position");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "product_snapshots" (
  "id" text PRIMARY KEY,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  "payload" jsonb NOT NULL,
  "actor_id" text REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "note" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_snapshots_product_captured_idx"
  ON "product_snapshots" ("product_id", "captured_at" DESC);
