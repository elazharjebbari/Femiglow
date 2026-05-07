-- ===========================================================================
-- Migration 0015 — Tagging d'intent sur chat_message + extensions enum.
-- ---------------------------------------------------------------------------
-- CHA-230 / Phase 1 — Robustification de la pipeline LangChain.
--
-- Pourquoi cette migration :
--
--   1. Ajoute trois colonnes nullable à `chat_message` pour persister
--      le tag d'intent classé pendant l'orchestrator. Ces colonnes
--      alimentent :
--         - le futur dashboard admin /admin/chat/quality (Phase 3) ;
--         - le futur curator UI /admin/chat/intent-curator (Phase 3) ;
--         - le pipeline d'enrichissement DB → golden-set (Phase 3).
--
--      Choix nullable : on ne back-fille pas les anciens messages —
--      cela exigerait d'invoquer `detectIntent()` sur des centaines
--      de milliers de lignes, sans gain (les intents passés sont déjà
--      historisés via chat_conversation_event payload `intent`).
--
--   2. Ajoute un index sur (intent_tag, created_at) pour les agrégats
--      Quality dashboard (« top intents 7j », « drift 30j »).
--
--   3. Pas d'`ALTER TYPE` pour `trigger_reason` (chat_lead) ni pour
--      `chat_conversation_event.type` : ces colonnes sont stockées
--      comme `text` avec contrainte CHECK gérée côté Drizzle. Les
--      nouvelles valeurs `negotiation` et `wholesaler` (cf. CHA-230
--      §2.6) entrent en vigueur dès le déploiement de schema.ts.
--
-- Réversibilité :
--   La migration est purement additive (ADD COLUMN, CREATE INDEX). Un
--   rollback consisterait à `DROP COLUMN` ces 3 colonnes et `DROP
--   INDEX chat_message_intent_idx`. Aucune perte de données pré-CHA-230.
--
-- cf. docs/chat-assistant/20-langchain-robustness-plan.md §2.8.1
-- ===========================================================================

ALTER TABLE "chat_message"
  ADD COLUMN IF NOT EXISTS "intent_tag" text,
  ADD COLUMN IF NOT EXISTS "intent_method" text,
  ADD COLUMN IF NOT EXISTS "intent_confidence" text;

CREATE INDEX IF NOT EXISTS "chat_message_intent_idx"
  ON "chat_message" ("intent_tag", "created_at");
