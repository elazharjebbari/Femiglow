-- ============================================================================
-- CHA-LEAD-V2-01 — Ajout colonne `kind` à `chat_session`.
--
-- Discriminateur entre conversations chat réelles ('chat') et "ghost sessions"
-- wizard utilisées comme pivot FK ('wizard_pivot'). 'system' couvre les flows
-- newsletter / admin seed.
--
-- Cf. docs/chat-conversations-leads-fix-2026-05/02-backend/migrations.md
-- ============================================================================

-- 1. Ajout colonne avec default 'chat' → toutes les rows historiques OK
ALTER TABLE "chat_session"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'chat' NOT NULL;
--> statement-breakpoint

-- 2. Contrainte CHECK pour limiter aux valeurs autorisées
DO $$ BEGIN
  ALTER TABLE "chat_session"
    ADD CONSTRAINT "chat_session_kind_check"
    CHECK ("kind" IN ('chat', 'wizard_pivot', 'system'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- 3. Index composé pour les queries admin (kind + status + last_seen_at DESC)
CREATE INDEX IF NOT EXISTS "chat_session_kind_status_idx"
  ON "chat_session" USING btree ("kind", "status", "last_seen_at" DESC);
--> statement-breakpoint

-- 4. Backfill historique : tout ID commençant par 's_' → wizard_pivot
UPDATE "chat_session"
   SET "kind" = 'wizard_pivot',
       "updated_at" = NOW()
 WHERE "id" LIKE 's\_%' ESCAPE '\'
   AND "kind" = 'chat';
