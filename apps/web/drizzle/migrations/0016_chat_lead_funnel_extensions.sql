-- ===========================================================================
-- Migration 0016 — chat_lead funnel extensions
-- ---------------------------------------------------------------------------
-- CHA-230 — étend `chat_lead` pour servir de table de fait du wizard
-- checkout. Le wizard crée un `chat_lead` dès le step 1, puis le `PATCH`
-- au fil de la progression (step 2 / step 3) avant de le lier à l'order
-- final (table `orders`, migration 0017).
--
-- Toutes les colonnes sont nullable ou ont un DEFAULT pour ne pas casser
-- les chat_leads existants (legacy chat widget) qui ne passent pas par
-- le wizard. CHECK constraints valident les valeurs énumérées.
--
-- Ref :
--   docs/checkout-funnel/05-plan-action.md §2 PR #2
--   docs/checkout-funnel/08-architecture-data.md §3.1
-- ===========================================================================

-- — Identité étendue — — — — — — — — — — — — — — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "email_consent" boolean NOT NULL DEFAULT false;

-- — Adresse de livraison — — — — — — — — — — — — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_city" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_address_line1" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_address_line2" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_postal_code" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_country" text NOT NULL DEFAULT 'MA';
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "shipping_notes" text;

-- — Préférence paiement — — — — — — — — — — — — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "preferred_payment_method" text;

-- — Source / Form context (taxonomie tracking) — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'chat_widget';
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "form_id" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "form_mode" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "variant_key" text;

-- — Ad attribution (Google / Meta) — — — — — — — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "gclid" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "fbp" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "fbc" text;

-- — Snapshot panier au moment de la capture (utile post-mortem) — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "cart_snapshot" jsonb;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "cart_total_cents" integer;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "cart_currency" text;

-- — Progression du tunnel (horloges par step) — — — — — — — — — — — — — —
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "last_touched_step" text;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "lead_captured_at" timestamp with time zone;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "address_completed_at" timestamp with time zone;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "payment_selected_at" timestamp with time zone;
ALTER TABLE "chat_lead" ADD COLUMN IF NOT EXISTS "purchased_at" timestamp with time zone;

--> statement-breakpoint

-- — CHECK constraints (idempotent) — — — — — — — — — — — — — — — — — — — —
-- Préférence paiement : CHECK n'autorise que les modes supportés. On
-- recrée le CHECK uniquement s'il n'existe pas (pg ne supporte pas
-- ADD CONSTRAINT IF NOT EXISTS sur CHECK avant pg 16, donc on utilise
-- un DO block pour rester compatible).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_lead_preferred_payment_method_check'
  ) THEN
    ALTER TABLE "chat_lead"
      ADD CONSTRAINT "chat_lead_preferred_payment_method_check"
      CHECK ("preferred_payment_method" IS NULL OR "preferred_payment_method" IN ('cod', 'bank_transfer', 'card'));
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_lead_source_check'
  ) THEN
    ALTER TABLE "chat_lead"
      ADD CONSTRAINT "chat_lead_source_check"
      CHECK ("source" IN ('chat_widget', 'wizard_kit', 'wizard_commander', 'newsletter', 'admin', 'inline'));
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_lead_form_mode_check'
  ) THEN
    ALTER TABLE "chat_lead"
      ADD CONSTRAINT "chat_lead_form_mode_check"
      CHECK ("form_mode" IS NULL OR "form_mode" IN ('wizard_embed', 'wizard_cart', 'legacy_cart', 'chat'));
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_lead_variant_key_check'
  ) THEN
    ALTER TABLE "chat_lead"
      ADD CONSTRAINT "chat_lead_variant_key_check"
      CHECK ("variant_key" IS NULL OR "variant_key" IN ('A', 'B', 'control'));
  END IF;
END $$;

--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_lead_last_touched_step_check'
  ) THEN
    ALTER TABLE "chat_lead"
      ADD CONSTRAINT "chat_lead_last_touched_step_check"
      CHECK ("last_touched_step" IS NULL OR "last_touched_step" IN ('cart_review', 'lead', 'address', 'payment', 'thank_you'));
  END IF;
END $$;

--> statement-breakpoint

-- — Indexes — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
-- email : index partial (where not null) — la majorité des chat_leads n'a
-- pas d'email (opt-in step 4 seulement).
CREATE INDEX IF NOT EXISTS "chat_lead_email_idx"
  ON "chat_lead" ("email") WHERE "email" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_lead_source_idx"
  ON "chat_lead" ("source", "created_at");

CREATE INDEX IF NOT EXISTS "chat_lead_form_idx"
  ON "chat_lead" ("form_id", "form_mode", "created_at");

CREATE INDEX IF NOT EXISTS "chat_lead_step_idx"
  ON "chat_lead" ("last_touched_step", "created_at");

-- — Comments — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
COMMENT ON COLUMN "chat_lead"."source" IS
  'Origine du lead (chat_widget par défaut, wizard_kit/commander pour le tunnel CHA-230).';
COMMENT ON COLUMN "chat_lead"."form_id" IS
  'ID stable du formulaire (ex. wizard_kit). NULL pour leads legacy chat.';
COMMENT ON COLUMN "chat_lead"."form_mode" IS
  'Mode d''embed (wizard_embed | wizard_cart | legacy_cart | chat).';
COMMENT ON COLUMN "chat_lead"."variant_key" IS
  'Clé A/B du variant assigné (sticky par visitor_id).';
COMMENT ON COLUMN "chat_lead"."cart_snapshot" IS
  'Snapshot {items, totalCents, currency} au moment de la capture step 1.';
