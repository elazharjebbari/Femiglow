-- Migration 0025 — Signature cryptographique de l'audit log
-- Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P3.4
--
-- Chaque entrée porte le hash SHA-256 de l'entrée précédente (chaîne) et
-- une signature HMAC SHA-256 calculée avec RITUAL_AUDIT_SECRET. Toute
-- modification a posteriori casse la chaîne et est détectable.

ALTER TABLE ritual_audit_log
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS signature text;

CREATE INDEX IF NOT EXISTS idx_ral_hash_chain
  ON ritual_audit_log (id, previous_hash);
