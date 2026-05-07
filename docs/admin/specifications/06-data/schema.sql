-- =====================================================================
-- FemiGlow Admin — Schéma Postgres v1
-- =====================================================================
-- Postgres 15 (Neon eu-central-1).
-- Identifiants : cuid2 (text 24 char, lexicographiquement triable).
-- Tous les timestamps sont timestamptz UTC.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. ADMIN_USERS — utilisatrices habilitées à l'admin
-- =====================================================================
CREATE TABLE admin_users (
  id              text        PRIMARY KEY,
  email           text        NOT NULL,
  password_hash   text        NOT NULL,                  -- argon2id
  name            text        NOT NULL,
  role            text        NOT NULL DEFAULT 'owner',  -- v1: 'owner' uniquement
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  deleted_at      timestamptz
);

CREATE UNIQUE INDEX admin_users_email_unique
  ON admin_users(LOWER(email))
  WHERE deleted_at IS NULL;

-- =====================================================================
-- 2. ADMIN_LOGIN_ATTEMPTS — protection brute-force
-- =====================================================================
CREATE TABLE admin_login_attempts (
  id          text        PRIMARY KEY,
  ip          text        NOT NULL,
  email       text        NOT NULL,
  success     boolean     NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_login_attempts_ip_idx
  ON admin_login_attempts(ip, created_at DESC);
CREATE INDEX admin_login_attempts_email_idx
  ON admin_login_attempts(email, created_at DESC);

-- Purge quotidienne (cron) : DELETE WHERE created_at < NOW() - INTERVAL '24h'

-- =====================================================================
-- 3. RATE_LIMIT_COUNTERS — rate-limiting générique
-- =====================================================================
CREATE TABLE rate_limit_counters (
  id          text        PRIMARY KEY,
  scope       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX rate_limit_counters_scope_idx
  ON rate_limit_counters(scope, created_at DESC);

-- =====================================================================
-- 4. LEADS — formulaires soumis depuis le site public
-- =====================================================================
CREATE TYPE lead_type   AS ENUM ('contact', 'order', 'newsletter', 'b2b');
CREATE TYPE lead_status AS ENUM ('new', 'in_progress', 'won', 'lost', 'spam');

CREATE TABLE leads (
  id          text        PRIMARY KEY,
  type        lead_type   NOT NULL,
  status      lead_status NOT NULL DEFAULT 'new',
  full_name   text        NOT NULL,
  email       text        NOT NULL,
  phone       text,
  city        text,
  source      text        NOT NULL,                       -- ex: 'form:contact', 'form:order'
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- libre : utm, referer, ip masquée…
  consent_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz
);

CREATE INDEX leads_created_at_idx          ON leads(created_at DESC);
CREATE INDEX leads_status_created_at_idx   ON leads(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX leads_type_idx                ON leads(type) WHERE deleted_at IS NULL;
CREATE INDEX leads_email_idx               ON leads(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX leads_search_idx              ON leads USING gin(
  to_tsvector('french', coalesce(full_name, '') || ' ' || coalesce(email, ''))
) WHERE deleted_at IS NULL;

-- =====================================================================
-- 5. ORDERS — détail commande pour leads de type 'order'
-- =====================================================================
CREATE TABLE orders (
  id              text          PRIMARY KEY,
  lead_id         text          NOT NULL REFERENCES leads(id),
  total_minor     integer       NOT NULL,            -- centimes (MAD = 100x)
  shipping_minor  integer       NOT NULL DEFAULT 0,
  currency        text          NOT NULL DEFAULT 'MAD',
  paid_at         timestamptz,
  shipping_address jsonb        NOT NULL,
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_lead_id_idx ON orders(lead_id);

-- =====================================================================
-- 6. ORDER_ITEMS
-- =====================================================================
CREATE TABLE order_items (
  id            text        PRIMARY KEY,
  order_id      text        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku           text        NOT NULL,
  name          text        NOT NULL,
  quantity      integer     NOT NULL CHECK (quantity > 0),
  unit_price_minor integer  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_id_idx ON order_items(order_id);

-- =====================================================================
-- 7. LEAD_EVENTS — timeline d'activité pour chaque lead
-- =====================================================================
CREATE TYPE lead_event_type AS ENUM (
  'created', 'status_change', 'note_added',
  'webhook_sent', 'webhook_failed', 'webhook_dead'
);

CREATE TABLE lead_events (
  id          text             PRIMARY KEY,
  lead_id     text             NOT NULL REFERENCES leads(id),
  type        lead_event_type  NOT NULL,
  actor_id    text             REFERENCES admin_users(id),
  body        text,                                       -- texte libre (notes)
  meta        jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz      NOT NULL DEFAULT NOW()
);

CREATE INDEX lead_events_lead_id_idx ON lead_events(lead_id, created_at DESC);

-- =====================================================================
-- 8. WEBHOOK_ENDPOINTS
-- =====================================================================
CREATE TABLE webhook_endpoints (
  id                 text        PRIMARY KEY,
  name               text        NOT NULL,
  url                text        NOT NULL,
  events             text[]      NOT NULL,                -- ['lead.created', …]
  description        text,
  custom_headers     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  encrypted_secret   bytea       NOT NULL,                -- pgp_sym_encrypt
  active             boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW(),
  deleted_at         timestamptz,
  CONSTRAINT webhook_url_unique UNIQUE NULLS NOT DISTINCT (url, deleted_at)
);

CREATE INDEX webhook_endpoints_active_idx
  ON webhook_endpoints(active) WHERE deleted_at IS NULL;
CREATE INDEX webhook_endpoints_events_idx
  ON webhook_endpoints USING gin(events) WHERE deleted_at IS NULL;

-- =====================================================================
-- 9. WEBHOOK_DELIVERIES — file d'attente + historique
-- =====================================================================
CREATE TYPE webhook_delivery_status AS ENUM (
  'pending', 'delivered', 'failed', 'dead'
);

CREATE TABLE webhook_deliveries (
  id                text                    PRIMARY KEY,
  endpoint_id       text                    NOT NULL REFERENCES webhook_endpoints(id),
  event_name        text                    NOT NULL,
  payload           jsonb                   NOT NULL,
  idempotency_key   text                    NOT NULL,
  signature         text                    NOT NULL,
  status            webhook_delivery_status NOT NULL DEFAULT 'pending',
  attempt           integer                 NOT NULL DEFAULT 0,
  max_attempts      integer                 NOT NULL DEFAULT 5,
  scheduled_at      timestamptz             NOT NULL DEFAULT NOW(),
  next_attempt_at   timestamptz,
  last_attempt_at   timestamptz,
  http_status       integer,
  duration_ms       integer,
  response_body     text,                                            -- tronqué à 1024
  created_at        timestamptz             NOT NULL DEFAULT NOW(),
  updated_at        timestamptz             NOT NULL DEFAULT NOW()
);

-- Critique pour le cron : trouve rapidement les pending dûs
CREATE INDEX webhook_deliveries_pending_idx
  ON webhook_deliveries(next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX webhook_deliveries_endpoint_created_idx
  ON webhook_deliveries(endpoint_id, created_at DESC);

CREATE INDEX webhook_deliveries_status_created_idx
  ON webhook_deliveries(status, created_at DESC);

-- =====================================================================
-- 10. AUDIT_EVENTS — journal append-only
-- =====================================================================
CREATE TABLE audit_events (
  id          text        PRIMARY KEY,
  actor_id    text        REFERENCES admin_users(id),
  action      text        NOT NULL,                     -- ex: 'admin.login', 'webhook.endpoint.deleted'
  target_type text,                                      -- ex: 'lead', 'webhook_endpoint'
  target_id   text,
  ip          text,
  user_agent  text,
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_events_actor_idx     ON audit_events(actor_id, created_at DESC);
CREATE INDEX audit_events_target_idx    ON audit_events(target_type, target_id, created_at DESC);
CREATE INDEX audit_events_action_idx    ON audit_events(action, created_at DESC);

-- =====================================================================
-- 11. UPDATED_AT triggers
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_users_touch         BEFORE UPDATE ON admin_users         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER leads_touch               BEFORE UPDATE ON leads               FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER orders_touch              BEFORE UPDATE ON orders              FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER webhook_endpoints_touch   BEFORE UPDATE ON webhook_endpoints   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER webhook_deliveries_touch  BEFORE UPDATE ON webhook_deliveries  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =====================================================================
-- FIN
-- =====================================================================
