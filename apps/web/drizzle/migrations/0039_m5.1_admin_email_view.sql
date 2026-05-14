-- ===========================================================================
-- Migration 0039 — M5.1 admin_email_view (saved views par admin)
-- ---------------------------------------------------------------------------
-- Saved views pour le cockpit emailing transactionnel : filtres + sort +
-- colonnes mémorisés par admin (custom) ou prédéfinis système (is_system=true).
--
-- Cf. docs/emailing/admin-evolution/01-data/01-tables.md#admin_email_view
-- ===========================================================================

CREATE TABLE IF NOT EXISTS admin_email_view (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email   text NOT NULL,
  name          text NOT NULL,
  scope         text NOT NULL CHECK (scope IN ('transactional', 'campaigns', 'automation')),
  filter_state  jsonb NOT NULL,
  is_system     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT admin_email_view_unique_per_owner UNIQUE (owner_email, scope, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_view_owner
  ON admin_email_view (owner_email, scope)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_email_view_system
  ON admin_email_view (scope, is_system)
  WHERE is_system = true AND deleted_at IS NULL;

-- Seed des vues système (idempotent). owner_email='system' = vue prédéfinie
-- visible par tous les admins. Modification → faut créer une variante owned.
INSERT INTO admin_email_view (owner_email, name, scope, filter_state, is_system)
SELECT 'system', v.name, 'transactional', v.filter_state::jsonb, true
FROM (VALUES
  ('All today',
    '{"filters":{"after":"today"},"sort":"date_desc","cols":["date","to","template","status","attempts"]}'),
  ('Failed today',
    '{"filters":{"after":"today","status":["failed","dlq"]},"sort":"date_desc","cols":["date","to","template","status","lastError"]}'),
  ('Bounces 7d',
    '{"filters":{"after":"-7d","status":["bounced_soft","bounced_permanent"]},"sort":"date_desc","cols":["date","to","template","status","bounceType"]}'),
  ('Awaiting retry',
    '{"filters":{"status":["pending","sending"]},"sort":"date_desc","cols":["date","to","template","status","attempts"]}')
) AS v(name, filter_state)
WHERE NOT EXISTS (
  SELECT 1 FROM admin_email_view
  WHERE owner_email = 'system' AND scope = 'transactional' AND name = v.name
);
