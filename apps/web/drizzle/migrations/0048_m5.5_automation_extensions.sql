-- ===========================================================================
-- Migration 0048 — M5.5 email_automation extensions
-- ---------------------------------------------------------------------------
-- Étend email_automation (cooldown, quiet_hours, daily_cap, trigger_conditions)
-- + email_automation_run (awaiting_event_name, awaiting_until, errored_*)
-- Status enum étendu avec 'waiting_for_event' via ALTER TYPE.
-- ===========================================================================

ALTER TABLE email_automation
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_tz text NOT NULL DEFAULT 'Africa/Casablanca',
  ADD COLUMN IF NOT EXISTS daily_cap integer,
  ADD COLUMN IF NOT EXISTS trigger_conditions jsonb;

-- Étendre enum status pour ajouter 'waiting_for_event'
DO $$ BEGIN
  ALTER TYPE email_automation_run_status ADD VALUE IF NOT EXISTS 'waiting_for_event' BEFORE 'completed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE email_automation_run
  ADD COLUMN IF NOT EXISTS awaiting_event_name text,
  ADD COLUMN IF NOT EXISTS awaiting_until timestamptz,
  ADD COLUMN IF NOT EXISTS errored_at timestamptz,
  ADD COLUMN IF NOT EXISTS errored_reason text;

-- Unique index pour bloquer les runs concurrents (cooldown enforcement DB-level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_run_active
  ON email_automation_run (automation_id, recipient_email)
  WHERE status IN ('running', 'waiting_for_event');
