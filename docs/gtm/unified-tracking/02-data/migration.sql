-- ============================================================================
-- Migration : ancien tracking → Unified Tracking Plan
-- À exécuter via Drizzle (apps/web/src/lib/db/migrations/NNNN_unified_tracking.sql)
-- Idempotent : peut être rejouée sans corruption.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Nouvelles tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tracking_plans (
  id              uuid          PRIMARY KEY,
  name            text          NOT NULL,
  status          text          NOT NULL CHECK (status IN ('draft','active','archived')),
  bundle_id       text          NOT NULL,
  plan            jsonb         NOT NULL,
  parent_version_id uuid        REFERENCES tracking_plans(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  created_by      text          NOT NULL,
  activated_at    timestamptz   NULL,
  archived_at     timestamptz   NULL,
  notes           text          NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_one_active
  ON tracking_plans(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_plans_bundle
  ON tracking_plans(bundle_id);

CREATE INDEX IF NOT EXISTS idx_plans_status_activated
  ON tracking_plans(status, activated_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_plans_plan_gin
  ON tracking_plans USING GIN (plan jsonb_path_ops);


CREATE TABLE IF NOT EXISTS tracking_plan_audit (
  id          bigserial     PRIMARY KEY,
  plan_id     uuid          NOT NULL REFERENCES tracking_plans(id) ON DELETE CASCADE,
  action      text          NOT NULL CHECK (action IN ('create','update','activate','archive','export','validate')),
  actor       text          NOT NULL,
  actor_ip    inet          NULL,
  actor_ua    text          NULL,
  diff        jsonb         NULL,
  metadata    jsonb         NULL,
  created_at  timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_plan ON tracking_plan_audit(plan_id, created_at DESC);

-- Trigger : interdire UPDATE/DELETE sur l'audit
CREATE OR REPLACE FUNCTION tp_audit_no_mutate() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'tracking_plan_audit est append-only (% interdit)', TG_OP;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON tracking_plan_audit;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON tracking_plan_audit
  FOR EACH ROW EXECUTE FUNCTION tp_audit_no_mutate();


CREATE TABLE IF NOT EXISTS tracking_defaults (
  key         text          PRIMARY KEY,
  value       text          NOT NULL,
  updated_at  timestamptz   NOT NULL DEFAULT NOW(),
  updated_by  text          NOT NULL
);


-- ---------------------------------------------------------------------------
-- 2. Renommage tables legacy (lecture seule)
-- NOTE : ces blocs sont conditionnels — si la table n'existe pas, ignore.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_providers') THEN
    ALTER TABLE tracking_providers RENAME TO tracking_providers_legacy_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_mapping_versions') THEN
    ALTER TABLE event_mapping_versions RENAME TO event_mapping_versions_legacy_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_mapping_audit') THEN
    ALTER TABLE event_mapping_audit RENAME TO event_mapping_audit_legacy_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_settings') THEN
    ALTER TABLE tracking_settings RENAME TO tracking_settings_legacy_v1;
  END IF;
END $$;

-- Revoke INSERT/UPDATE/DELETE sur les legacy tables (lecture seule)
-- (Pour les rôles applicatifs, pas pour le DBA)
-- À adapter au schema de rôles du projet.

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Population initiale via script TypeScript
-- ---------------------------------------------------------------------------
-- Voir scripts/migrate-tracking-plan.ts (lance: pnpm tsx scripts/migrate-tracking-plan.ts)
-- Le script lit les tables _legacy_v1 et insère 1 ligne dans tracking_plans (status='active').
