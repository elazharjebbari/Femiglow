-- ===========================================================================
-- Migration 0019 — product_stock
-- ---------------------------------------------------------------------------
-- CHA-230 — Stock par variant (SKU). Permet :
--   - d'afficher un StockIndicator dans le wizard ("derniers exemplaires")
--   - de bloquer la commande quand `available - reserved <= 0`
--   - de capter une demande de notification (back-in-stock) via une table
--     dérivée (introduite si nécessaire en post-launch).
--
-- Modèle :
--   - 1 ligne par variant (PRIMARY KEY = variant_id) — relation 1-1.
--   - `available` : stock physique disponible.
--   - `reserved`  : stock réservé (in-flight orders non confirmés).
--   - `threshold_low` : seuil au-dessous duquel on affiche "derniers
--                       exemplaires" côté UI.
--
-- Concurrence : toutes les mutations passent par `UPDATE … WHERE
-- (available - reserved) > 0` pour éviter le double-spend. Le code
-- (PR #3 — repo) implémente le pattern Compare-And-Swap.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "product_stock" (
  "variant_id" text PRIMARY KEY,
  "sku" text NOT NULL,
  "available" integer NOT NULL DEFAULT 0,
  "reserved" integer NOT NULL DEFAULT 0,
  "threshold_low" integer NOT NULL DEFAULT 5,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text,
  CONSTRAINT "product_stock_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "product_stock_available_nonneg"
    CHECK ("available" >= 0),
  CONSTRAINT "product_stock_reserved_nonneg"
    CHECK ("reserved" >= 0),
  CONSTRAINT "product_stock_threshold_nonneg"
    CHECK ("threshold_low" >= 0)
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "product_stock_sku_unique"
  ON "product_stock" ("sku");

-- Index sur (available - reserved) pour les lectures "is in stock"
-- rapides. Pas une expression index complexe — on stocke le calcul
-- côté code dans la requête `effective = available - reserved`.
CREATE INDEX IF NOT EXISTS "product_stock_available_idx"
  ON "product_stock" ("available", "reserved");

--> statement-breakpoint

-- Seed : 1 ligne par variant existant, available = 100, reserved = 0.
-- Idempotent : ne crée que les rows absentes (ON CONFLICT DO NOTHING).
INSERT INTO "product_stock" ("variant_id", "sku", "available", "reserved", "threshold_low", "updated_at")
SELECT
  v."id",
  v."sku",
  100,
  0,
  5,
  now()
FROM "product_variants" v
ON CONFLICT ("variant_id") DO NOTHING;

--> statement-breakpoint

COMMENT ON TABLE "product_stock" IS
  'Stock par variant (CHA-230). Affichage StockIndicator + blocage commandes.';
COMMENT ON COLUMN "product_stock"."reserved" IS
  'Stock réservé par orders in-flight. Décrémenté à la confirmation ou au timeout.';
COMMENT ON COLUMN "product_stock"."threshold_low" IS
  'Seuil "derniers exemplaires" — affichage UI quand available <= seuil.';
