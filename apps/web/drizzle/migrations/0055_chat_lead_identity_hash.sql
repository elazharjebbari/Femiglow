-- CHA-240 — Add identity_hash column for multi-identity dedup.
--
-- Allows the same session to have multiple leads when the identity
-- (phone + name) differs, while still blocking true duplicates
-- (same session + same phone + same name).
--
-- Strategy:
--   1. Add nullable column
--   2. Backfill from existing phone_e164 + first_name
--   3. Set NOT NULL
--   4. Replace session_id unique index with composite (session_id, identity_hash)
--   5. Add standalone hash index for admin queries

-- Step 1: Add nullable column (non-breaking)
ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS identity_hash text;

-- Step 2: Backfill — uses the same normalization as computeIdentityHash():
--   trim(phone_e164) || '|' || lower(trim(first_name))
--   PostgreSQL's encode(digest(..., 'sha256'), 'hex') produces the same
--   output as Node.js crypto.createHash('sha256').update(raw, 'utf8').digest('hex').
UPDATE chat_lead
SET identity_hash = encode(digest(
  trim(phone_e164) || '|' || lower(trim(first_name)),
  'sha256'
), 'hex')
WHERE identity_hash IS NULL;

-- Step 3: Make NOT NULL now that all rows are backfilled
ALTER TABLE chat_lead
  ALTER COLUMN identity_hash SET NOT NULL;

-- Step 4: Replace old per-session unique index with composite (session_id, identity_hash)
DROP INDEX IF EXISTS chat_lead_session_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS chat_lead_session_identity_unique_idx
  ON chat_lead (session_id, identity_hash);

-- Step 5: Standalone hash index for admin lookups by identity
CREATE INDEX IF NOT EXISTS chat_lead_identity_hash_idx
  ON chat_lead (identity_hash);