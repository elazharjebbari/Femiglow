-- ===========================================================================
-- Migration 0017 — orders funnel extensions
-- ---------------------------------------------------------------------------
-- CHA-230 — relie `orders` à `chat_lead` (FK optionnelle) et durcit les
-- CHECK constraints sur `payment_method` et `shipping_mode` pour matcher
-- la taxonomie du wizard.
--
-- La FK est nullable pour préserver les orders historiques (créées via
-- l'ancien CheckoutFlow, où `leads.id` était la seule référence). Le
-- linking est strict côté code pour les nouveaux orders wizard.
-- ===========================================================================

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "chat_lead_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "form_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "form_mode" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "variant_key" text;

--> statement-breakpoint

-- FK chat_lead — optionnelle, ON DELETE SET NULL pour éviter une
-- cascade destructive si on archive un chat_lead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_chat_lead_fk'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_chat_lead_fk"
      FOREIGN KEY ("chat_lead_id") REFERENCES "chat_lead"("id") ON DELETE SET NULL;
  END IF;
END $$;

--> statement-breakpoint

-- CHECK payment_method — uniquement valide pour les NOUVEAUX orders.
-- Pour ne pas invalider les existants, on utilise NOT VALID puis VALIDATE
-- seulement si la table est saine. Ici : on autorise les anciennes
-- valeurs (cod, bank_transfer, card) ; si une valeur historique diffère,
-- elle reste en place sans validation immédiate.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_payment_method_check"
      CHECK ("payment_method" IN ('cod', 'bank_transfer', 'card'))
      NOT VALID;
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_mode_check'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_shipping_mode_check"
      CHECK ("shipping_mode" IN ('standard', 'express', 'pickup'))
      NOT VALID;
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_form_mode_check'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_form_mode_check"
      CHECK ("form_mode" IS NULL OR "form_mode" IN ('wizard_embed', 'wizard_cart', 'legacy_cart'));
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_variant_key_check'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_variant_key_check"
      CHECK ("variant_key" IS NULL OR "variant_key" IN ('A', 'B', 'control'));
  END IF;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "orders_chat_lead_idx" ON "orders" ("chat_lead_id");
CREATE INDEX IF NOT EXISTS "orders_form_idx"      ON "orders" ("form_id", "form_mode", "created_at");

COMMENT ON COLUMN "orders"."chat_lead_id" IS
  'FK vers chat_lead.id (CHA-230). NULL pour orders legacy (avant migration).';
