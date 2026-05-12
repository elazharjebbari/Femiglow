-- ===========================================================================
-- Migration 0020 — form_variant_assignment
-- ---------------------------------------------------------------------------
-- CHA-230 — Stickiness des variants A/B par `(visitor_id, form_id)`.
-- Garantit qu'un visiteur voit toujours le même variant pendant le rollout
-- de l'A/B test (PR #8 / PR #9).
--
-- Pas de FK sur `visitor_id` : le visitor vit côté cookie analytics, pas
-- en table. Le tuple est ses propres PRIMARY KEY pour empêcher les
-- doublons.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "form_variant_assignment" (
  "visitor_id" text NOT NULL,
  "form_id" text NOT NULL,
  "variant_key" text NOT NULL,
  "experiment_key" text,
  "assigned_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "form_variant_assignment_pk" PRIMARY KEY ("visitor_id", "form_id"),
  CONSTRAINT "form_variant_assignment_variant_check"
    CHECK ("variant_key" IN ('A', 'B', 'control'))
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "form_variant_assignment_form_variant_idx"
  ON "form_variant_assignment" ("form_id", "variant_key", "assigned_at");

CREATE INDEX IF NOT EXISTS "form_variant_assignment_experiment_idx"
  ON "form_variant_assignment" ("experiment_key", "assigned_at")
  WHERE "experiment_key" IS NOT NULL;

--> statement-breakpoint

COMMENT ON TABLE "form_variant_assignment" IS
  'Stickiness A/B (CHA-230). 1 ligne par (visitor_id, form_id).';
COMMENT ON COLUMN "form_variant_assignment"."experiment_key" IS
  'Clé d''expérience (ex. `kit_wizard_v1`). NULL pour rollout binaire.';
