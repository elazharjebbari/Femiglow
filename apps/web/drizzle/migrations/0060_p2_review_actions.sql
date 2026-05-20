-- P2 Review Actions: rejection, variation, cancellation, archive columns
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "parentDraftId" text REFERENCES content_draft(id) ON DELETE SET NULL;
ALTER TABLE content_idea ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledBy" text;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelReason" text;
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewerId" text;
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewType" text NOT NULL DEFAULT 'auto';
CREATE INDEX IF NOT EXISTS idx_content_draft_parent ON content_draft("parentDraftId");
CREATE INDEX IF NOT EXISTS idx_content_post_status ON content_post(status);
CREATE INDEX IF NOT EXISTS idx_content_idea_status ON content_idea(status);