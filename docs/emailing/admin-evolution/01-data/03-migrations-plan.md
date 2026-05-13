# Plan de migrations Drizzle

> Toutes les migrations DDL exécutables, par phase, dans l'ordre. Une
> migration = un fichier `.sql` (timestamp + nom descriptif), tracé dans
> `apps/web/drizzle/migrations/`.

## Convention

```
0040_m5.1_admin_email_view.sql
0041_m5.2_user_event.sql
0042_m5.2_user_event_indexes.sql
0043_m5.3_email_audience.sql
0044_m5.3_email_audience_snapshot.sql
0045_m5.3_email_audience_snapshot_member.sql
0046_m5.4_campaign_link_audience.sql
0047_m5.5_email_automation_extensions.sql
0048_m5.5_lead_tag.sql
0049_m5.5_automation_run_extensions.sql
```

## Stratégie

- **Toutes les nouvelles tables** : créées avec `IF NOT EXISTS` pour
  idempotency
- **ALTER TABLE** : `IF NOT EXISTS` sur colonnes ajoutées
- **Indexes** : `CREATE INDEX CONCURRENTLY` si la table existe déjà avec
  du volume (`email_outbox`, `email_event`)
- **Rollback** : chaque migration a son `.down.sql` documenté dans
  `02-rollback.md`

---

## M5.1 — admin_email_view

```sql
-- 0040_m5.1_admin_email_view.sql

CREATE TABLE IF NOT EXISTS admin_email_view (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email       text NOT NULL,
  name              text NOT NULL,
  scope             text NOT NULL CHECK (scope IN ('transactional', 'campaigns', 'automation')),
  filter_state      jsonb NOT NULL,
  is_system         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  UNIQUE (owner_email, scope, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_email_view_owner
  ON admin_email_view(owner_email, scope) WHERE deleted_at IS NULL;

-- Seed system views (idempotent)
INSERT INTO admin_email_view (owner_email, name, scope, filter_state, is_system)
SELECT 'system', 'All today', 'transactional',
  '{"filters":{"after":"today"},"sort":"date_desc"}'::jsonb, true
WHERE NOT EXISTS (
  SELECT 1 FROM admin_email_view WHERE owner_email = 'system' AND name = 'All today'
);
-- ... (4 system views au total)
```

## M5.2 — user_event

```sql
-- 0041_m5.2_user_event.sql

CREATE TABLE IF NOT EXISTS user_event (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  event_name    text NOT NULL,
  ts            timestamptz NOT NULL DEFAULT now(),
  properties    jsonb NOT NULL DEFAULT '{}',
  session_id    text,
  source        text NOT NULL CHECK (source IN ('web', 'server', 'email', 'admin', 'import')),
  lead_id       uuid REFERENCES leads(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 0042_m5.2_user_event_indexes.sql (séparé pour CONCURRENTLY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_event_email_ts ON user_event(email, ts DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_event_name_ts ON user_event(event_name, ts DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_event_session ON user_event(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_event_properties_gin ON user_event USING gin (properties);
```

## M5.3 — Audiences

```sql
-- 0043_m5.3_email_audience.sql

CREATE TABLE IF NOT EXISTS email_audience (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  rules           jsonb NOT NULL,
  exclusion_flags jsonb NOT NULL DEFAULT '{
    "hard_bounce": true,
    "unsubscribe": true,
    "manual_suppression": true,
    "marketing_optout": false
  }'::jsonb,
  evaluation_mode text NOT NULL DEFAULT 'dynamic'
    CHECK (evaluation_mode IN ('static', 'dynamic')),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 0044_m5.3_email_audience_snapshot.sql
CREATE TABLE IF NOT EXISTS email_audience_snapshot (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id         uuid NOT NULL REFERENCES email_audience(id) ON DELETE CASCADE,
  snapshot_key        text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'errored')),
  size                integer NOT NULL DEFAULT 0,
  rules_snapshot      jsonb NOT NULL,
  exclusion_snapshot  jsonb NOT NULL,
  metadata            jsonb NOT NULL DEFAULT '{}',
  listmonk_list_id    integer,
  listmonk_list_name  text,
  errored_at          timestamptz,
  errored_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  purgeable_after     timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  UNIQUE (audience_id, snapshot_key)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_audience ON email_audience_snapshot(audience_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshot_purge ON email_audience_snapshot(purgeable_after) WHERE listmonk_list_id IS NOT NULL;

-- 0045_m5.3_email_audience_snapshot_member.sql
CREATE TABLE IF NOT EXISTS email_audience_snapshot_member (
  snapshot_id   uuid NOT NULL REFERENCES email_audience_snapshot(id) ON DELETE CASCADE,
  email         text NOT NULL,
  payload       jsonb,
  PRIMARY KEY (snapshot_id, email)
);

CREATE INDEX IF NOT EXISTS idx_member_email ON email_audience_snapshot_member(email);
```

## M5.4 — Campaign link audience

```sql
-- 0046_m5.4_campaign_link_audience.sql
ALTER TABLE email_campaign_link
  ADD COLUMN IF NOT EXISTS audience_id uuid REFERENCES email_audience(id),
  ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES email_audience_snapshot(id),
  ADD COLUMN IF NOT EXISTS snapshot_listmonk_list_id integer;

CREATE INDEX IF NOT EXISTS idx_campaign_audience ON email_campaign_link(audience_id);
```

## M5.5 — Automation extensions + lead_tag

```sql
-- 0047_m5.5_email_automation_extensions.sql
ALTER TABLE email_automation
  ADD COLUMN IF NOT EXISTS cooldown_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_tz text NOT NULL DEFAULT 'Africa/Casablanca',
  ADD COLUMN IF NOT EXISTS daily_cap integer,
  ADD COLUMN IF NOT EXISTS trigger_conditions jsonb;

-- 0048_m5.5_lead_tag.sql
CREATE TABLE IF NOT EXISTS lead_tag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'automation', 'import')),
  source_ref  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_lead_tag_tag ON lead_tag(tag);
CREATE INDEX IF NOT EXISTS idx_lead_tag_lead ON lead_tag(lead_id);

-- 0049_m5.5_automation_run_extensions.sql
ALTER TABLE email_automation_run
  ADD COLUMN IF NOT EXISTS awaiting_event_name text,
  ADD COLUMN IF NOT EXISTS awaiting_until timestamptz,
  ADD COLUMN IF NOT EXISTS errored_at timestamptz,
  ADD COLUMN IF NOT EXISTS errored_reason text;

-- Extend status check
ALTER TABLE email_automation_run DROP CONSTRAINT IF EXISTS email_automation_run_status_check;
ALTER TABLE email_automation_run ADD CONSTRAINT email_automation_run_status_check
  CHECK (status IN ('pending', 'running', 'waiting_for_event', 'completed', 'errored', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_run_active ON email_automation_run(automation_id, recipient_email)
  WHERE status IN ('pending', 'running', 'waiting_for_event');
```

## Ordre d'exécution

```bash
# Sur worktree dev :
cd /var/www/femiglow-m5/apps/web
pnpm drizzle-kit generate    # génère le SQL si modif schema TS
pnpm drizzle-kit migrate     # applique aux DB locales / staging / prod
```

## Tests post-migration (chaque phase)

| Phase | Vérification |
|---|---|
| M5.1 | `\dt admin_email_view`, 4 system views seedées |
| M5.2 | `\dt user_event`, indexes en place (`\d user_event`) |
| M5.3 | 3 tables, 1 audience test créable |
| M5.4 | colonnes ajoutées, FK valides |
| M5.5 | colonnes ajoutées, unique index active runs OK |

Tests SQL :
```sql
-- M5.3 smoke test
INSERT INTO email_audience (slug, name, rules, created_by)
VALUES ('test', 'Test', '{"kind":"all","conditions":[]}'::jsonb, 'admin@x');
SELECT * FROM email_audience WHERE slug='test';
DELETE FROM email_audience WHERE slug='test';
```
