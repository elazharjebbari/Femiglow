-- Migration TrackingPlan v2 (TP2-001 → TP2-004)
-- Crée les tables tracking_plans, tracking_plan_audit, tracking_defaults.
-- L'audit est append-only via trigger qui bloque UPDATE/DELETE.

CREATE TYPE tracking_plan_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE tracking_plan_audit_action AS ENUM ('create', 'update', 'activate', 'archive', 'rollback');

CREATE TABLE tracking_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status tracking_plan_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  env_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tracking_plans_status_idx ON tracking_plans (status);
CREATE INDEX tracking_plans_created_at_idx ON tracking_plans (created_at);
CREATE UNIQUE INDEX tracking_plans_unique_active
  ON tracking_plans (status)
  WHERE status = 'active';

CREATE TABLE tracking_plan_audit (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  action tracking_plan_audit_action NOT NULL,
  actor_email TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tracking_plan_audit_plan_idx ON tracking_plan_audit (plan_id);
CREATE INDEX tracking_plan_audit_created_at_idx ON tracking_plan_audit (created_at);

CREATE OR REPLACE FUNCTION tracking_plan_audit_block_mutations()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tracking_plan_audit table is append-only (no UPDATE/DELETE allowed)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tracking_plan_audit_no_update
  BEFORE UPDATE ON tracking_plan_audit
  FOR EACH ROW EXECUTE FUNCTION tracking_plan_audit_block_mutations();

CREATE TRIGGER tracking_plan_audit_no_delete
  BEFORE DELETE ON tracking_plan_audit
  FOR EACH ROW EXECUTE FUNCTION tracking_plan_audit_block_mutations();

CREATE TABLE tracking_defaults (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  env_hint TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
