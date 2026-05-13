-- ===========================================================================
-- Migration 0027 — colonnes manquantes sur component_media_bindings
-- ---------------------------------------------------------------------------
-- Récupère les colonnes ajoutées via `db:push` historiquement mais jamais
-- journalisées (object_fit, object_position, focal_x, focal_y, background_fill).
-- Idempotent : utilise IF NOT EXISTS et DO $$ pour les enum.
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE "media_object_fit" AS ENUM ('cover', 'contain', 'fill', 'none', 'scale-down');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "media_object_position" AS ENUM ('center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "component_media_bindings"
  ADD COLUMN IF NOT EXISTS "object_fit" "media_object_fit" NOT NULL DEFAULT 'cover';

ALTER TABLE "component_media_bindings"
  ADD COLUMN IF NOT EXISTS "object_position" "media_object_position" NOT NULL DEFAULT 'center';

ALTER TABLE "component_media_bindings"
  ADD COLUMN IF NOT EXISTS "focal_x" integer;

ALTER TABLE "component_media_bindings"
  ADD COLUMN IF NOT EXISTS "focal_y" integer;

ALTER TABLE "component_media_bindings"
  ADD COLUMN IF NOT EXISTS "background_fill" text;
