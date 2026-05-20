-- P3: Idempotency keys table + campaigns support
CREATE TABLE IF NOT EXISTS "content_idempotency_key" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "response_json" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "expires_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "content_idempotency_key_expires_idx" ON "content_idempotency_key" ("expires_at");