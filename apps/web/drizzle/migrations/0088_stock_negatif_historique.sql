-- Stock vendable en négatif et historique des mouvements.
--
-- `available` peut désormais passer sous 0 : une rupture du compteur n'arrête
-- plus les ventes tant que `sell_when_out` est vrai (décision du 06/11/2026,
-- après 65 minutes de commandes refusées). Le compteur ne reflète que les
-- commandes, pas les colis : il n'a jamais à bloquer une vente par défaut.

ALTER TABLE "product_stock" DROP CONSTRAINT IF EXISTS "product_stock_available_nonneg";
ALTER TABLE "product_stock" ADD COLUMN IF NOT EXISTS "sell_when_out" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "product_stock_movements" (
  "id" text PRIMARY KEY,
  "variant_id" text NOT NULL,
  "kind" text NOT NULL,
  "delta" integer NOT NULL,
  "available_after" integer NOT NULL,
  "note" text,
  "actor_id" text,
  "idempotency_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "product_stock_movements_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "product_stock_movements_kind_check"
    CHECK ("kind" IN ('restock', 'count', 'threshold', 'policy'))
);

CREATE INDEX IF NOT EXISTS "product_stock_movements_variant_idx"
  ON "product_stock_movements" ("variant_id", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "product_stock_movements_idempotency_idx"
  ON "product_stock_movements" ("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
