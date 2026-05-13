# Tables — DDL et spec

> Spec détaillée de chaque nouvelle table + modifications. Pour DDL
> exécutables : [03-migrations-plan.md](03-migrations-plan.md).

---

## admin_email_view

**Phase** : M5.1
**Rôle** : Vues sauvées par admin pour la transactional inbox

```sql
CREATE TABLE admin_email_view (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email       text NOT NULL,
  name              text NOT NULL,
  scope             text NOT NULL CHECK (scope IN ('transactional', 'campaigns', 'automation')),
  filter_state      jsonb NOT NULL,    -- { filters: {...}, sort: 'date_desc', cols: [...] }
  is_system         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  UNIQUE (owner_email, scope, name)
);

CREATE INDEX idx_admin_email_view_owner ON admin_email_view(owner_email, scope) WHERE deleted_at IS NULL;
```

**Notes** :
- `is_system=true` = vue prédéfinie (All today, Failed today, etc.), pas
  d'owner_email (NULL ou 'system')
- `filter_state` exemple :
  ```json
  {
    "filters": { "status": ["failed"], "template": "cart-*" },
    "sort": "date_desc",
    "cols": ["date","to","template","status","attempts"]
  }
  ```

---

## user_event

**Phase** : M5.2
**Rôle** : Events utilisateur unifiés. Source de vérité pour audience
builder + automation conditions.

```sql
CREATE TABLE user_event (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,            -- clé de jointure
  event_name    text NOT NULL,            -- ex: 'cart.added', 'email.opened'
  ts            timestamptz NOT NULL DEFAULT now(),
  properties    jsonb NOT NULL DEFAULT '{}',
  session_id    text,                     -- lien sessions web
  source        text NOT NULL CHECK (source IN ('web', 'server', 'email', 'admin', 'import')),
  lead_id       uuid REFERENCES leads(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_event_email_ts ON user_event(email, ts DESC);
CREATE INDEX idx_user_event_name_ts ON user_event(event_name, ts DESC);
CREATE INDEX idx_user_event_session ON user_event(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_user_event_properties_gin ON user_event USING gin (properties);
```

**Partitioning futur** : si > 100M rows, partitionner par mois sur `ts`.
Préparation : utiliser pg_partman ou natif PG13+ list partitioning.

**Bridges qui INSERT** :
- Web tracking (M5.2 step 2) : middleware `/api/tracking/events`
- Email webhooks (M5.2 step 3) : listmonk-dispatcher + stalwart-handler
- Server actions (M5.2 step 4) : wrappers `createOrder()`,
  `createLead()`, etc.
- Admin actions (M5.2 step 5) : wrapper `recordLeadEvent()`

---

## email_audience

**Phase** : M5.3
**Rôle** : Définition d'une audience (règles).

```sql
CREATE TABLE email_audience (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  rules           jsonb NOT NULL,        -- voir ADR-004
  exclusion_flags jsonb NOT NULL DEFAULT '{
    "hard_bounce": true,
    "unsubscribe": true,
    "manual_suppression": true,
    "marketing_optout": false
  }',
  evaluation_mode text NOT NULL DEFAULT 'dynamic'
    CHECK (evaluation_mode IN ('static', 'dynamic')),
  created_by      text NOT NULL,         -- email admin
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_email_audience_slug ON email_audience(slug) WHERE deleted_at IS NULL;
```

---

## email_audience_snapshot

**Phase** : M5.3
**Rôle** : Snapshot figé d'une audience à un moment T.

```sql
CREATE TABLE email_audience_snapshot (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id         uuid NOT NULL REFERENCES email_audience(id) ON DELETE CASCADE,
  snapshot_key        text,                  -- nullable, pour idempotency (campaign_id-based)
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'errored')),
  size                integer NOT NULL DEFAULT 0,
  rules_snapshot      jsonb NOT NULL,        -- copie des rules au moment du snapshot
  exclusion_snapshot  jsonb NOT NULL,        -- copie de exclusion_flags
  metadata            jsonb NOT NULL DEFAULT '{}',  -- { build_duration_ms, source }
  listmonk_list_id    integer,               -- nullable; set après push éphémère
  listmonk_list_name  text,                  -- ex 'fg-vip-snap-abc'
  errored_at          timestamptz,
  errored_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  purgeable_after     timestamptz NOT NULL,  -- created_at + 90 days
  UNIQUE (audience_id, snapshot_key)
);

CREATE INDEX idx_snapshot_audience ON email_audience_snapshot(audience_id, created_at DESC);
CREATE INDEX idx_snapshot_purge ON email_audience_snapshot(purgeable_after) WHERE listmonk_list_id IS NOT NULL;
```

---

## email_audience_snapshot_member

**Phase** : M5.3
**Rôle** : Les emails matchant un snapshot.

```sql
CREATE TABLE email_audience_snapshot_member (
  snapshot_id   uuid NOT NULL REFERENCES email_audience_snapshot(id) ON DELETE CASCADE,
  email         text NOT NULL,
  payload       jsonb,                       -- ex: {firstName, totalSpent}
  PRIMARY KEY (snapshot_id, email)
);

CREATE INDEX idx_member_email ON email_audience_snapshot_member(email);
```

**Note de design** : on duplique l'email dans cette table (vs FK
vers leads) pour préserver la snapshot même si le lead est supprimé
RGPD ultérieurement. Le purge J+90 sur snapshot supprime aussi les
members en cascade.

---

## lead_tag

**Phase** : M5.5
**Rôle** : Tags manuels ou automatiques sur un lead.

```sql
CREATE TABLE lead_tag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag         text NOT NULL,                  -- ex 'cart_lost', 'vip_2026'
  source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'automation', 'import')),
  source_ref  text,                           -- ex automation slug si source='automation'
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag)
);

CREATE INDEX idx_lead_tag_tag ON lead_tag(tag);
CREATE INDEX idx_lead_tag_lead ON lead_tag(lead_id);
```

---

## Modifications tables existantes

### email_campaign_link (M5.4)

```sql
ALTER TABLE email_campaign_link ADD COLUMN audience_id uuid REFERENCES email_audience(id);
ALTER TABLE email_campaign_link ADD COLUMN snapshot_id uuid REFERENCES email_audience_snapshot(id);
ALTER TABLE email_campaign_link ADD COLUMN snapshot_listmonk_list_id integer;
-- audienceLinkIds (jsonb) reste pour compat ascendante, sera dépréciée
```

### email_automation (M5.5)

```sql
ALTER TABLE email_automation ADD COLUMN cooldown_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE email_automation ADD COLUMN quiet_hours_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE email_automation ADD COLUMN quiet_hours_start text NOT NULL DEFAULT '08:00';
ALTER TABLE email_automation ADD COLUMN quiet_hours_end text NOT NULL DEFAULT '22:00';
ALTER TABLE email_automation ADD COLUMN quiet_hours_tz text NOT NULL DEFAULT 'Africa/Casablanca';
ALTER TABLE email_automation ADD COLUMN daily_cap integer;     -- nullable = unlimited
ALTER TABLE email_automation ADD COLUMN trigger_conditions jsonb;
```

### email_automation_run (M5.5)

```sql
ALTER TABLE email_automation_run ADD COLUMN awaiting_event_name text;
ALTER TABLE email_automation_run ADD COLUMN awaiting_until timestamptz;
ALTER TABLE email_automation_run ADD COLUMN errored_at timestamptz;
ALTER TABLE email_automation_run ADD COLUMN errored_reason text;
-- status enum extended: ('pending', 'running', 'waiting_for_event', 'completed', 'errored', 'cancelled')

CREATE UNIQUE INDEX idx_run_active ON email_automation_run(automation_id, recipient_email)
  WHERE status IN ('pending', 'running', 'waiting_for_event');
```

### email_automation.steps (jsonb) — schémas étendus

```typescript
type AutomationStep =
  | { kind: 'wait'; durationMs: number; label?: string }
  | { kind: 'send'; template: string; payloadKeys: string[]; varMappings?: Record<string,string> }
  | { kind: 'branch'; condition: RulesJson; ifTrue: AutomationStep[]; ifFalse: AutomationStep[] }
  | { kind: 'tag'; action: 'add'|'remove'; tag: string }
  | { kind: 'update_lead'; field: string; value: unknown }
  | { kind: 'webhook'; url: string; method: 'POST'|'PUT'; body: Record<string,unknown> }
  | { kind: 'wait_for_event'; eventName: string; timeoutMs: number; onTimeout: 'continue'|'abort' };
```

Stockés en `email_automation.steps` (jsonb) et `email_automation_run`
suit l'index courant.

---

## Schéma RulesJson (réutilisable)

Spec en TypeScript (à matérialiser en Zod) :

```typescript
type RulesGroup = {
  kind: 'all' | 'any';     // AND ou OR
  conditions: (Rule | RulesGroup)[];
};

type Rule =
  // Identité
  | { kind: 'email_pattern'; operator: 'contains'|'starts'|'ends'|'equals'; value: string }
  | { kind: 'country'; operator: 'eq'|'in'; value: string|string[] }
  | { kind: 'consent_marketing'; value: boolean }
  | { kind: 'created_at'; operator: 'before'|'after'|'between'; value: string|[string,string] }
  // Commerce
  | { kind: 'order_count'; operator: 'gte'|'lte'|'eq'|'between'; value: number|[number,number]; since?: string; until?: string }
  | { kind: 'order_total'; operator: 'gte'|'lte'|'eq'|'between'; value: number|[number,number]; currency: 'MAD'; since?: string }
  | { kind: 'has_ordered_product'; productId: string; since?: string }
  | { kind: 'last_order_at'; operator: 'before'|'after'|'within'; value: string }
  // Engagement
  | { kind: 'email_opened'; templateSlug?: string; within?: string; minCount?: number }
  | { kind: 'email_clicked'; urlPattern?: string; within?: string; minCount?: number }
  | { kind: 'received_without_open'; threshold: number; within: string }
  // Activité
  | { kind: 'inactive_since'; days: number }
  | { kind: 'session_count'; operator: 'gte'|'lte'; value: number; within?: string }
  // Tags
  | { kind: 'has_tag'; tag: string }
  | { kind: 'not_has_tag'; tag: string };
```

**Compileur** : voir [02-backend/03-rules-compiler.md](../02-backend/03-rules-compiler.md).
