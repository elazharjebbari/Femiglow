-- CHA-230 — Ajoute 'negotiation' (marchandage / rabais) et 'wholesaler'
-- (volume pro / grossiste) aux raisons de déclenchement du formulaire lead.
--
-- Pourquoi une migration ALTER séparée alors que 0014 contient déjà ces
-- valeurs inline ? Parce que `drizzle migrate()` ne rejoue PAS 0014 sur les
-- bases déjà déployées (hash enregistré dans __drizzle_migrations). Cette
-- migration met donc à jour la CHECK constraint sur l'existant, tandis que
-- 0014 couvre les provisionnements frais (CI / E2E). Idempotente via
-- DROP CONSTRAINT IF EXISTS (cf. pattern 0037_canned_pair_lead_trigger.sql).

ALTER TABLE chat_lead
  DROP CONSTRAINT IF EXISTS chat_lead_trigger_reason_check;

ALTER TABLE chat_lead
  ADD CONSTRAINT chat_lead_trigger_reason_check
  CHECK (
    trigger_reason IN (
      'explicit-request',
      'out-of-knowledge',
      'objection-repeat',
      'long-no-progress',
      'frustration',
      'after-hours',
      'b2b',
      'purchase-intent',
      'inline-contact',
      'negotiation',
      'wholesaler',
      'manual'
    )
  );
