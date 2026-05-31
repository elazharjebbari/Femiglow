-- Deduplicate existing leads: keep the most recent per session, delete older ones.
-- Must run BEFORE creating the unique index.
WITH duplicates AS (
  SELECT a.id AS delete_id
  FROM chat_lead a
  JOIN chat_lead b
    ON a.session_id = b.session_id
   AND a.created_at < b.created_at
)
DELETE FROM chat_lead
WHERE id IN (SELECT delete_id FROM duplicates);

-- Add unique constraint on session_id to prevent future duplicate leads.
-- A visitor session should have at most one lead.
CREATE UNIQUE INDEX IF NOT EXISTS chat_lead_session_unique_idx
  ON chat_lead (session_id);