-- Migration 0026 — Outbound webhook log (CHA-260)
--
-- Journalisation unifiée des webhooks sortants pour les triggers métier :
--   - order.completed (commande créée via wizard)
--   - cart.abandoned  (chat_lead avec phone valide, pas d'achat, > 30 min)
--   - lead.chat       (capture in-chat)
--   - lead.contact    (formulaire contact pro avec téléphone)
--   - lead.newsletter (skip si pas de phone — voir code)
--
-- Le payload POSTé est PLAT (cf. runbook §1). Cette table sert d'outbox
-- avec idempotency unique (header `idempotency-key`).

CREATE TABLE IF NOT EXISTS outbound_webhook_log (
  id              text PRIMARY KEY,
  source          text NOT NULL,
  source_id       text NOT NULL,
  idempotency_key text NOT NULL,
  event_name      text NOT NULL,
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  attempt_count   integer NOT NULL DEFAULT 0,
  last_error      text,
  response_status integer,
  latency_ms      integer,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS outbound_webhook_log_idem_idx
  ON outbound_webhook_log(idempotency_key);

CREATE INDEX IF NOT EXISTS outbound_webhook_log_source_idx
  ON outbound_webhook_log(source, source_id);

CREATE INDEX IF NOT EXISTS outbound_webhook_log_status_idx
  ON outbound_webhook_log(status, created_at DESC);

-- Anti-doublon pour le scan cart-abandon : une seule tentative outbound par lead.
ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS abandon_webhook_at timestamptz;

CREATE INDEX IF NOT EXISTS chat_lead_abandon_scan_idx
  ON chat_lead(created_at)
  WHERE abandon_webhook_at IS NULL
    AND purchased_at IS NULL
    AND phone_e164 IS NOT NULL;
