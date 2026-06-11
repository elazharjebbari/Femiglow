-- ===========================================================================
-- Migration 0014 — chat_lead + extension enum chat_conversation_event.type
-- ---------------------------------------------------------------------------
-- CHA-200 / CHA-203 — formulaire de capture de contact in-chat.
--
-- 1. Ajout de la table `chat_lead` (FK fortes sur `chat_session`,
--    snapshot conversation, cycle webhook, cycle CRM/outcome).
-- 2. Pas de migration d'enum SQL pour `chat_conversation_event.type` :
--    Drizzle stocke ce type comme `text` avec contrainte CHECK gérée
--    côté code. Aucun ALTER TYPE n'est nécessaire — le nouvel enum
--    côté schema.ts entre en vigueur dès le déploiement.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "chat_lead" (
  "id" text PRIMARY KEY,
  "session_id" text NOT NULL,
  "triggering_message_id" text,
  "trigger_reason" text NOT NULL,
  "first_name" text NOT NULL,
  "phone_e164" text NOT NULL,
  "phone_raw" text NOT NULL,
  "note" text,
  "consent_version" text NOT NULL,
  "consent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "visitor_id" text NOT NULL,
  "fingerprint_hash" text,
  "page" text,
  "referrer" text,
  "utm" jsonb,
  "language" text NOT NULL,
  "intent_at_capture" text,
  "snapshot_messages" jsonb,
  "webhook_status" text DEFAULT 'pending' NOT NULL,
  "webhook_attempts" integer DEFAULT 0 NOT NULL,
  "webhook_last_error" text,
  "webhook_sent_at" timestamp with time zone,
  "handled_by" text,
  "handled_at" timestamp with time zone,
  "outcome" text DEFAULT 'pending' NOT NULL,
  "converted_order_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chat_lead_session_fk"
    FOREIGN KEY ("session_id") REFERENCES "chat_session"("id") ON DELETE CASCADE,
  CONSTRAINT "chat_lead_trigger_reason_check" CHECK (
    "trigger_reason" IN (
      'explicit-request',
      'out-of-knowledge',
      'objection-repeat',
      'long-no-progress',
      'frustration',
      'after-hours',
      'b2b',
      -- CHA-225 — Nouvelles raisons (intent d'achat / coordonnées en clair).
      'purchase-intent',
      'inline-contact',
      -- CHA-230 — Marchandage (rabais) + volume pro (grossiste) :
      -- escalade humaine immédiate. cf. contracts.ts chatLeadTriggerReasonSchema.
      'negotiation',
      'wholesaler',
      'manual'
    )
  ),
  CONSTRAINT "chat_lead_webhook_status_check" CHECK (
    "webhook_status" IN ('pending', 'sent', 'failed', 'disabled')
  ),
  CONSTRAINT "chat_lead_outcome_check" CHECK (
    "outcome" IN ('pending', 'reached', 'no-answer', 'converted', 'discarded')
  )
);

CREATE INDEX IF NOT EXISTS "chat_lead_session_idx"
  ON "chat_lead" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "chat_lead_visitor_idx"
  ON "chat_lead" ("visitor_id");

CREATE INDEX IF NOT EXISTS "chat_lead_outcome_idx"
  ON "chat_lead" ("outcome", "created_at");

CREATE INDEX IF NOT EXISTS "chat_lead_webhook_idx"
  ON "chat_lead" ("webhook_status", "created_at");

CREATE INDEX IF NOT EXISTS "chat_lead_phone_idx"
  ON "chat_lead" ("phone_e164");

-- ===========================================================================
-- Toggle runtime : active/désactive l'offre de formulaire (kill switch
-- éditorial sans redeploy). Lu par `shouldOfferLeadForm`.
-- ===========================================================================

INSERT INTO "chat_runtime_setting" ("key", "value_bool", "updated_by")
VALUES ('lead_form_enabled', true, 'system')
ON CONFLICT ("key") DO NOTHING;
