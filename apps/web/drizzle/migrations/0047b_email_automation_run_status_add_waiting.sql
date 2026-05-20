-- @no-transaction:true
-- Add 'waiting_for_event' to email_automation_run_status enum
-- Must be in a separate migration from the index that references it (0048)
ALTER TYPE email_automation_run_status ADD VALUE IF NOT EXISTS 'waiting_for_event' BEFORE 'completed';
