-- ===========================================================================
-- Migration 0021 — checkout_idempotency
-- ---------------------------------------------------------------------------
-- CHA-230 — Stocke les clés d'idempotence des appels API checkout pour
-- éviter de re-créer un lead / une order si l'utilisateur retape sur
-- "Confirmer" (mobile flaky network).
--
-- Modèle :
--   - `key` : opaque côté client (UUID/ulid). Combiné au `scope` pour
--             permettre la même clé sur des scopes différents.
--   - `scope` : opération concernée (lead_create | address_update |
--               payment_select | order_create).
--   - `resource_id` : ID de la ressource créée/modifiée (chat_lead.id ou
--                     order.id).
--   - `response_json` : payload de la réponse — re-servi à l'identique
--                       au second appel avec la même clé.
--   - `expires_at` : TTL (24h par défaut). Nettoyage par cron / job.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "checkout_idempotency" (
  "key" text NOT NULL,
  "scope" text NOT NULL,
  "resource_id" text,
  "request_hash" text NOT NULL,
  "response_json" jsonb NOT NULL,
  "response_status" integer NOT NULL DEFAULT 200,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT "checkout_idempotency_pk" PRIMARY KEY ("key", "scope"),
  CONSTRAINT "checkout_idempotency_scope_check"
    CHECK ("scope" IN ('lead_create', 'address_update', 'payment_select', 'order_create', 'email_optin')),
  CONSTRAINT "checkout_idempotency_status_check"
    CHECK ("response_status" >= 100 AND "response_status" < 600)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "checkout_idempotency_expires_idx"
  ON "checkout_idempotency" ("expires_at");

CREATE INDEX IF NOT EXISTS "checkout_idempotency_resource_idx"
  ON "checkout_idempotency" ("resource_id")
  WHERE "resource_id" IS NOT NULL;

--> statement-breakpoint

COMMENT ON TABLE "checkout_idempotency" IS
  'Clés idempotence wizard checkout (CHA-230). TTL 24h.';
COMMENT ON COLUMN "checkout_idempotency"."request_hash" IS
  'SHA256 du payload de requête — détecte les changements de payload entre 2 tentatives avec la même key.';
COMMENT ON COLUMN "checkout_idempotency"."response_json" IS
  'Payload exact de la réponse à re-servir au second appel (replay).';
