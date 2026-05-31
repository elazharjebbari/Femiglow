-- ===========================================================================
-- Migration 0018 — form_config + form_config_history
-- ---------------------------------------------------------------------------
-- CHA-230 — Configuration versionnée des wizards (steps activés, libellés,
-- copy, validation côté serveur, modes d'affichage). Permet à l'admin
-- d'ajuster la config sans déployer.
--
-- Modèle :
--   - `form_config` : 1 ligne par formulaire (key UNIQUE), avec un JSONB
--     `config` (schéma validé côté Zod, cf. PR #3).
--   - `form_config_history` : audit log de chaque changement (version
--     monotone, JSONB de l'état complet, actor_id).
--
-- Seed : 2 formulaires par défaut (`wizard_kit` et `wizard_commander`)
-- avec une config minimale (steps activés, valeurs par défaut).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "form_config" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "active" boolean NOT NULL DEFAULT true,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_by" text
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "form_config_key_unique"
  ON "form_config" ("key");

CREATE INDEX IF NOT EXISTS "form_config_active_idx"
  ON "form_config" ("active", "updated_at");

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "form_config_history" (
  "id" text PRIMARY KEY,
  "form_config_id" text NOT NULL,
  "key" text NOT NULL,
  "version" integer NOT NULL,
  "config" jsonb NOT NULL,
  "description" text,
  "actor_id" text,
  "action" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "form_config_history_form_config_fk"
    FOREIGN KEY ("form_config_id") REFERENCES "form_config"("id") ON DELETE CASCADE,
  CONSTRAINT "form_config_history_action_check"
    CHECK ("action" IN ('create', 'update', 'activate', 'deactivate', 'rollback'))
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "form_config_history_form_idx"
  ON "form_config_history" ("form_config_id", "version" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "form_config_history_version_unique"
  ON "form_config_history" ("form_config_id", "version");

--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- Seed : 2 formulaires par défaut (wizard_kit + wizard_commander).
-- La config est minimale et stable ; le détail (copy, validation) vit
-- côté Zod schema (PR #3) qui valide cette JSONB au runtime.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO "form_config" ("id", "key", "version", "active", "config", "description", "created_at", "updated_at")
VALUES
  (
    'fc_seed_wizard_kit',
    'wizard_kit',
    1,
    true,
    '{
      "steps": ["lead", "address", "payment", "thank_you"],
      "modes": ["wizard_embed"],
      "defaults": {
        "form_mode": "wizard_embed",
        "currency": "MAD",
        "country": "MA",
        "payment_methods": ["cod", "bank_transfer"]
      },
      "copy": {
        "title": "Commander le rituel FemiGlow",
        "cta_lead": "Continuer",
        "cta_address": "Choisir le paiement",
        "cta_payment": "Confirmer la commande",
        "thank_you_title": "Commande reçue, on vous rappelle."
      },
      "validation": {
        "phone_min_length": 9,
        "phone_max_length": 13,
        "require_email_on_thank_you": false
      }
    }'::jsonb,
    'Wizard embed sur la page produit /kit (mode A).',
    now(),
    now()
  ),
  (
    'fc_seed_wizard_commander',
    'wizard_commander',
    1,
    true,
    '{
      "steps": ["cart_review", "lead", "address", "payment", "thank_you"],
      "modes": ["wizard_cart"],
      "defaults": {
        "form_mode": "wizard_cart",
        "currency": "MAD",
        "country": "MA",
        "payment_methods": ["cod", "bank_transfer"]
      },
      "copy": {
        "title": "Finaliser ma commande",
        "cta_cart": "Continuer",
        "cta_lead": "Continuer",
        "cta_address": "Choisir le paiement",
        "cta_payment": "Confirmer la commande",
        "thank_you_title": "Commande reçue, on vous rappelle."
      },
      "validation": {
        "phone_min_length": 9,
        "phone_max_length": 13,
        "require_email_on_thank_you": false
      }
    }'::jsonb,
    'Wizard cart sur la page /commander (mode B).',
    now(),
    now()
  )
ON CONFLICT ("key") DO NOTHING;

--> statement-breakpoint

-- Seed history rows (one per seeded form_config). Idempotent via PRIMARY KEY.
INSERT INTO "form_config_history" ("id", "form_config_id", "key", "version", "config", "description", "action", "actor_id", "created_at")
SELECT
  'fch_seed_' || "key",
  "id",
  "key",
  "version",
  "config",
  'Seed initial (CHA-230)',
  'create',
  NULL,
  now()
FROM "form_config"
WHERE "key" IN ('wizard_kit', 'wizard_commander')
ON CONFLICT ("id") DO NOTHING;

--> statement-breakpoint

COMMENT ON TABLE "form_config" IS
  'Configuration versionnée des wizards (CHA-230). key UNIQUE par formulaire.';
COMMENT ON COLUMN "form_config"."config" IS
  'JSONB validé côté code (cf. apps/web/src/lib/checkout/form-config/schema.ts).';
COMMENT ON TABLE "form_config_history" IS
  'Audit log de chaque changement de form_config. Une ligne par mise à jour.';
