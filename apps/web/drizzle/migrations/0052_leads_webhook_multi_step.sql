-- Migration 0052 — Leads webhook multi-step.
--
-- Ajoute les horloges dédiées au webhook step2 et au webhook d'abandon step1.
-- Les colonnes sont nullable et idempotentes pour un déploiement sans
-- interruption. L'idempotence métier reste assurée par outbound_webhook_log.

ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS step2_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS step1_abandon_webhook_at timestamptz;

CREATE INDEX IF NOT EXISTS chat_lead_step1_abandon_pending_idx
  ON chat_lead(lead_captured_at)
  WHERE lead_captured_at IS NOT NULL
    AND address_completed_at IS NULL
    AND purchased_at IS NULL
    AND step1_abandon_webhook_at IS NULL
    AND phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_lead_step2_webhook_idx
  ON chat_lead(step2_webhook_at)
  WHERE step2_webhook_at IS NOT NULL;

INSERT INTO tracking_settings (id, key, value, updated_at, updated_by)
VALUES
  ('tset_lead_step2_webhook_enabled', 'lead.step2_webhook_enabled', 'true'::jsonb, now(), null),
  ('tset_lead_step1_abandon_enabled', 'lead.step1_abandon_enabled', 'true'::jsonb, now(), null),
  ('tset_lead_step1_abandon_timeout_minutes', 'lead.step1_abandon_timeout_minutes', '5'::jsonb, now(), null),
  ('tset_lead_webhook_conversation_enabled', 'lead.webhook_conversation_enabled', 'true'::jsonb, now(), null),
  ('tset_lead_webhook_conversation_max_messages', 'lead.webhook_conversation_max_messages', '50'::jsonb, now(), null),
  ('tset_lead_webhook_conversation_max_bytes', 'lead.webhook_conversation_max_bytes', '30000'::jsonb, now(), null)
ON CONFLICT (key) DO NOTHING;
