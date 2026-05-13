# 02 — Modèle de données

> Tables Drizzle côté FemiGlow + schéma Listmonk (référence externe) + bridge entre les deux. À lire avant les migrations.

## §1 — Vue d'ensemble

Deux bases physiques, séparées intentionnellement :

```
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│ DB FemiGlow (Postgres existante)│         │ DB Listmonk (Postgres dédiée)   │
│ ─ schema `public`               │         │ ─ schema `public`               │
│                                 │         │                                 │
│ email_outbox          ◄────────►│ ─ via   │ campaigns                       │
│ email_event                     │  API    │ subscribers                     │
│ email_template_meta             │  REST   │ lists                           │
│ email_audience_link  ◄────────►│  +      │ templates                       │
│ email_campaign_link  ◄────────►│  hooks  │ subscriber_lists                │
│ email_subscriber_link◄────────►│         │ campaign_lists                  │
│ email_suppression               │         │ bounces                         │
│ email_automation                │         │ campaign_views                  │
│ email_automation_run            │         │ link_clicks                    │
│ email_settings                  │         │ subscriber_events              │
│ audit_log (existant)            │         │ settings                        │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

- **DB FemiGlow** : source de vérité pour le transactionnel + bridge (mapping `subscriber_id` Listmonk ↔ user FemiGlow), audit, automation runner.
- **DB Listmonk** : source de vérité pour les broadcasts (templates Listmonk, lists, abonnés, métriques campagnes). On **ne lit jamais directement** la DB Listmonk depuis FemiGlow — toujours via son API.

Justification : Listmonk recommande sa propre DB. Mutualiser provoquerait conflits de migrations, et Listmonk fait des opérations bulk (cron `subscriber_count`) qui peuvent contention si schéma partagé.

## §2 — Tables Drizzle FemiGlow

Toutes dans `apps/web/src/db/schema/emails.ts`, importées par `apps/web/src/db/schema/index.ts`.

### 2.1 — `email_outbox`

Source de vérité du transactionnel. At-least-once.

```ts
export const emailOutbox = pgTable('email_outbox', {
  id:               text('id').primaryKey(),                  // ulid()
  idempotencyKey:   text('idempotency_key').notNull().unique(), // ex: "contact-ack:ip:2026-05-13"
  template:         text('template').notNull(),                // 'contact-acknowledgement'
  templateVersion:  integer('template_version').notNull(),     // pour invalidation safe
  toEmail:          text('to_email').notNull(),
  toName:           text('to_name'),
  fromEmail:        text('from_email').notNull(),              // noreply@…
  replyTo:          text('reply_to'),
  subject:          text('subject').notNull(),
  payloadJson:      jsonb('payload_json').notNull().default({}),// variables template
  htmlSnapshot:     text('html_snapshot'),                     // rendu final (post-send, audit)
  textSnapshot:     text('text_snapshot'),
  status:           text('status', { enum: STATUS }).notNull().default('pending'),
  attempts:         integer('attempts').notNull().default(0),
  maxAttempts:      integer('max_attempts').notNull().default(5),
  nextRetry:        timestamp('next_retry'),
  lastError:        text('last_error'),
  smtpMessageId:    text('smtp_message_id'),                   // Message-ID retour Stalwart
  smtpResponse:     text('smtp_response'),
  queueId:          text('queue_id'),                          // Stalwart queueId via webhook
  scheduledFor:     timestamp('scheduled_for'),                // null = immédiat
  deliveredAt:      timestamp('delivered_at'),
  bouncedAt:        timestamp('bounced_at'),
  bounceReason:     text('bounce_reason'),
  bounceType:       text('bounce_type', { enum: BOUNCE_TYPES }),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
  createdByUserId:  text('created_by_user_id'),                // si trigger admin
  source:           text('source'),                            // 'api.contact', 'cron.automation:welcome', …
}, (t) => ({
  statusIdx:       index('email_outbox_status_idx').on(t.status, t.nextRetry),
  toEmailIdx:      index('email_outbox_to_email_idx').on(t.toEmail),
  createdAtIdx:    index('email_outbox_created_at_idx').on(t.createdAt),
  templateIdx:     index('email_outbox_template_idx').on(t.template),
  smtpMessageIdIdx:index('email_outbox_smtp_message_id_idx').on(t.smtpMessageId),
}));

const STATUS = [
  'pending',          // créé, attend l'envoi
  'sending',          // en cours (verrou anti-double-send)
  'sent',             // accepté par Stalwart (250 OK SMTP)
  'delivered',        // accepté par MX destinataire (via webhook Stalwart)
  'opened',           // pixel ouvert (uniquement broadcasts via Listmonk)
  'clicked',          // au moins un click
  'failed',           // erreur transient, sera retry
  'bounced_soft',     // bounce 4xx, retry
  'bounced_permanent',// bounce 5xx, no retry
  'suppressed',       // destinataire dans suppression list au moment du send
  'dlq',              // max_attempts atteint, dead letter
] as const;

const BOUNCE_TYPES = ['soft', 'hard', 'complaint', 'unsubscribe'] as const;
```

**Notes** :
- `idempotency_key` = `${template}:${user_id|email}:${YYYY-MM-DD}` typiquement. Empêche double envoi sur retry HTTP ou re-exécution cron.
- `html_snapshot` / `text_snapshot` : stocké après render pour audit (RGPD : « pourriez-vous me montrer le mail exact reçu le 13 mai ? »). Purge après 90 jours par cron.
- `template_version` : invalidation safe. Si on change le template `contact-acknowledgement.tsx`, on bump la version dans `lib/mail/catalog.ts`. Permet `WHERE template = 'X' AND template_version = 3` pour audit.

### 2.2 — `email_event`

Journal append-only de tous les events liés à un envoi.

```ts
export const emailEvent = pgTable('email_event', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  outboxId:     text('outbox_id').references(() => emailOutbox.id, { onDelete: 'cascade' }),
  campaignId:   text('campaign_id'),                          // null si tx (cf. email_campaign_link)
  subscriberId: text('subscriber_id'),                        // ID Listmonk
  type:         text('type', { enum: EVENT_TYPES }).notNull(),
  ts:           timestamp('ts').defaultNow().notNull(),
  source:       text('source', { enum: ['stalwart', 'listmonk', 'app'] }).notNull(),
  rawJson:      jsonb('raw_json'),                            // payload webhook brut
  ip:           text('ip'),
  userAgent:    text('user_agent'),
  linkUrl:      text('link_url'),                             // si click
}, (t) => ({
  outboxIdx:    index('email_event_outbox_idx').on(t.outboxId, t.ts),
  campaignIdx:  index('email_event_campaign_idx').on(t.campaignId, t.ts),
  tsIdx:        index('email_event_ts_idx').on(t.ts),
  typeIdx:      index('email_event_type_idx').on(t.type),
}));

const EVENT_TYPES = [
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced_soft',
  'bounced_hard',
  'complaint',
  'unsubscribed',
  'failed',
  'retried',
  'suppressed',
  'dlq',
] as const;
```

### 2.3 — `email_template_meta`

Métadonnées des templates react-email. Le code des templates vit dans `lib/mail/templates/` et est sourcé Git ; cette table sert à activer/désactiver, versionner, et stocker des données d'audit (variables documentées, last_used_at).

```ts
export const emailTemplateMeta = pgTable('email_template_meta', {
  slug:          text('slug').primaryKey(),                  // 'contact-acknowledgement'
  displayName:   text('display_name').notNull(),             // 'Accusé de contact'
  category:      text('category', { enum: TEMPLATE_CATEGORIES }).notNull(),
  description:   text('description'),
  variables:     jsonb('variables').notNull().default([]),   // [{ name, type, required, sample }]
  active:        boolean('active').notNull().default(true),
  version:       integer('version').notNull().default(1),
  listmonkTemplateId: integer('listmonk_template_id'),       // si sync vers Listmonk
  lastUsedAt:    timestamp('last_used_at'),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});

const TEMPLATE_CATEGORIES = ['transactional', 'broadcast', 'automation'] as const;
```

### 2.4 — `email_audience_link`

Bridge `lists` Listmonk ↔ `audiences` FemiGlow. Permet d'attacher des règles applicatives (filtres custom, métadonnées campagne) sans modifier le schéma Listmonk.

```ts
export const emailAudienceLink = pgTable('email_audience_link', {
  id:              text('id').primaryKey(),                  // ulid()
  listmonkListId:  integer('listmonk_list_id').notNull().unique(),
  name:            text('name').notNull(),                   // miroir read-cache
  type:            text('type', { enum: ['public', 'private'] }).notNull(),
  optinMode:       text('optin_mode', { enum: ['single', 'double'] }).notNull().default('double'),
  segmentRules:    jsonb('segment_rules'),                   // filtres avancés FemiGlow
  subscriberCount: integer('subscriber_count').notNull().default(0),  // refresh cron
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  syncedAt:        timestamp('synced_at'),
});
```

### 2.5 — `email_campaign_link`

Bridge campaigns Listmonk ↔ FemiGlow. Stocke le qui-a-déclenché et les KPI mirroirs.

```ts
export const emailCampaignLink = pgTable('email_campaign_link', {
  id:                text('id').primaryKey(),                 // ulid()
  listmonkCampaignId:integer('listmonk_campaign_id').unique(),// null jusqu'au sync
  status:            text('status', { enum: CAMPAIGN_STATUS }).notNull().default('draft'),
  name:              text('name').notNull(),
  subject:           text('subject').notNull(),
  templateSlug:      text('template_slug').references(() => emailTemplateMeta.slug),
  audienceLinkIds:   jsonb('audience_link_ids').notNull().default([]),  // [ulid, ulid]
  scheduledFor:      timestamp('scheduled_for'),
  startedAt:         timestamp('started_at'),
  finishedAt:        timestamp('finished_at'),
  sentCount:         integer('sent_count').notNull().default(0),
  deliveredCount:    integer('delivered_count').notNull().default(0),
  openCount:         integer('open_count').notNull().default(0),
  clickCount:        integer('click_count').notNull().default(0),
  bounceCount:       integer('bounce_count').notNull().default(0),
  unsubscribeCount:  integer('unsubscribe_count').notNull().default(0),
  abVariant:         text('ab_variant'),                      // null si pas A/B
  createdByUserId:   text('created_by_user_id'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  statusIdx:       index('email_campaign_status_idx').on(t.status, t.scheduledFor),
  createdAtIdx:    index('email_campaign_created_at_idx').on(t.createdAt),
}));

const CAMPAIGN_STATUS = [
  'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed',
] as const;
```

### 2.6 — `email_subscriber_link`

Bridge subscribers Listmonk ↔ users FemiGlow (le cas échéant).

```ts
export const emailSubscriberLink = pgTable('email_subscriber_link', {
  email:              text('email').primaryKey(),            // canonical (lowercased)
  listmonkSubscriberId: integer('listmonk_subscriber_id').unique(),
  userId:             text('user_id'),                       // si lié à un user FemiGlow
  firstName:          text('first_name'),
  consentAt:          timestamp('consent_at'),
  consentSource:      text('consent_source'),                // 'newsletter-form', 'checkout-optin', …
  doubleOptinConfirmedAt: timestamp('double_optin_confirmed_at'),
  unsubscribedAt:     timestamp('unsubscribed_at'),
  status:             text('status', { enum: SUBSCRIBER_STATUS }).notNull().default('pending'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  syncedAt:           timestamp('synced_at'),
});

const SUBSCRIBER_STATUS = ['pending', 'enabled', 'disabled', 'blocklisted'] as const;
```

### 2.7 — `email_suppression`

Liste des "à ne plus contacter, jamais". Vérifiée **avant chaque envoi** (transactional ET broadcast). Doublonnée avec Listmonk.

```ts
export const emailSuppression = pgTable('email_suppression', {
  email:    text('email').primaryKey(),
  reason:   text('reason', { enum: SUPPRESSION_REASONS }).notNull(),
  detail:   text('detail'),                                  // ex. SMTP 550 message
  since:    timestamp('since').defaultNow().notNull(),
  source:   text('source', { enum: ['stalwart', 'listmonk', 'manual', 'cndp'] }).notNull(),
});

const SUPPRESSION_REASONS = [
  'hard_bounce', 'soft_bounce_repeated', 'complaint', 'unsubscribe',
  'manual_admin', 'cndp_request', 'invalid_format',
] as const;
```

### 2.8 — `email_automation`

Définition d'un workflow déclenché.

```ts
export const emailAutomation = pgTable('email_automation', {
  id:           text('id').primaryKey(),                     // ulid()
  slug:         text('slug').notNull().unique(),             // 'cart-abandoned-1h'
  name:         text('name').notNull(),
  triggerType:  text('trigger_type', { enum: TRIGGER_TYPES }).notNull(),
  triggerConfig:jsonb('trigger_config').notNull(),
  steps:        jsonb('steps').notNull(),                    // [{ wait, condition, template, … }]
  active:       boolean('active').notNull().default(false),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

const TRIGGER_TYPES = [
  'event',          // event applicatif (ex. 'cart.abandoned')
  'schedule',       // cron (ex. anniversaire J)
  'subscription',   // nouveau subscriber sur liste X
  'webhook',        // POST extérieur
] as const;
```

### 2.9 — `email_automation_run`

État d'exécution d'une instance d'automation pour un destinataire donné.

```ts
export const emailAutomationRun = pgTable('email_automation_run', {
  id:                text('id').primaryKey(),                // ulid()
  automationId:      text('automation_id').notNull().references(() => emailAutomation.id),
  recipientEmail:    text('recipient_email').notNull(),
  triggeredAt:       timestamp('triggered_at').defaultNow().notNull(),
  currentStep:       integer('current_step').notNull().default(0),
  status:            text('status', { enum: AUTOMATION_STATUS }).notNull().default('running'),
  contextJson:       jsonb('context_json').notNull().default({}),
  nextActionAt:      timestamp('next_action_at'),
  finishedAt:        timestamp('finished_at'),
  outboxIds:         jsonb('outbox_ids').notNull().default([]),
}, (t) => ({
  automationIdx:  index('automation_run_automation_idx').on(t.automationId, t.status),
  nextActionIdx:  index('automation_run_next_action_idx').on(t.nextActionAt).where(sql`status = 'running'`),
  emailIdx:       index('automation_run_email_idx').on(t.recipientEmail),
}));

const AUTOMATION_STATUS = ['running', 'completed', 'cancelled', 'errored'] as const;
```

### 2.10 — `email_settings`

Singleton config admin (UI dans `/admin/emails/settings`).

```ts
export const emailSettings = pgTable('email_settings', {
  key:    text('key').primaryKey(),    // 'global'
  json:   jsonb('json').notNull(),     // { from, replyTo, footer, …}
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## §3 — Schéma Listmonk (référence)

Pour mémoire et pour les requêtes JOIN éventuelles (debug uniquement, **jamais en prod**). Liste des tables clés :

| Table Listmonk | Rôle |
|---|---|
| `subscribers` | Personnes inscrites (email, name, attribs JSON, status) |
| `lists` | Listes / mailing lists |
| `subscriber_lists` | Pivot subscriber × list (avec opt-in status) |
| `templates` | Templates HTML+Liquid |
| `campaigns` | Campagnes (status, subject, body, lists[], sent_at) |
| `campaign_lists` | Pivot campaign × list |
| `campaign_views` | Pixel open hits |
| `link_clicks` | Click rewrite hits |
| `bounces` | Bounces parsés (POP3 ou webhook) |
| `subscriber_events` | Événements subscriber (subscribe, unsubscribe, blocklist) |
| `media` | Images uploadées dans le compositeur |
| `settings` | Config Listmonk (SMTP, etc.) |

Connexion read-only de debug : utilisateur Postgres `listmonk_readonly` (créé en `09-infrastructure-setup.md`).

## §4 — Migrations Drizzle

Numérotées à la suite des migrations existantes (rechercher `pnpm db:generate` pour le prochain numéro disponible).

### M0-001 — bootstrap tables emailing

Crée toutes les tables `email_*`. Idempotent (vérifie `IF NOT EXISTS`). Pas de données seed sauf `email_settings` ligne `global` avec defaults.

### M0-002 — index complémentaires

Index `email_outbox` composé `(status, next_retry, created_at)` pour le cron pickup performant.

### M2-001 — seed des templates initiaux

Insert dans `email_template_meta` les 5 templates initiaux :
- `contact-acknowledgement`
- `lead-notification-admin`
- `newsletter-confirm`
- `password-reset`
- `order-confirmation`

Variables documentées et `version=1`.

### M3-001 — seed audiences

Lecture API Listmonk + INSERT initial des `email_audience_link` correspondant aux lists existantes. Idempotent par `listmonk_list_id`.

## §5 — Vues SQL pour le dashboard

Vues matérialisées rafraîchies par cron `/api/cron/tick` (toutes les 5 min).

### `mv_email_kpi_daily`

```sql
CREATE MATERIALIZED VIEW mv_email_kpi_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked'))      AS sent,
  COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked'))             AS delivered,
  COUNT(*) FILTER (WHERE status IN ('opened','clicked'))                         AS opened,
  COUNT(*) FILTER (WHERE status = 'clicked')                                     AS clicked,
  COUNT(*) FILTER (WHERE status IN ('bounced_soft','bounced_permanent'))         AS bounced,
  COUNT(*) FILTER (WHERE status = 'suppressed')                                  AS suppressed,
  COUNT(*) FILTER (WHERE status = 'dlq')                                         AS dlq
FROM email_outbox
WHERE created_at >= now() - interval '90 days'
GROUP BY 1;

CREATE UNIQUE INDEX mv_email_kpi_daily_day_idx ON mv_email_kpi_daily(day);
```

### `mv_email_template_perf`

```sql
CREATE MATERIALIZED VIEW mv_email_template_perf AS
SELECT
  template,
  template_version,
  COUNT(*)                                              AS attempts,
  COUNT(*) FILTER (WHERE status = 'delivered')          AS delivered,
  COUNT(*) FILTER (WHERE status = 'opened')             AS opened,
  COUNT(*) FILTER (WHERE status = 'clicked')            AS clicked,
  COUNT(*) FILTER (WHERE status = 'bounced_permanent')  AS hard_bounce,
  COUNT(*) FILTER (WHERE status = 'dlq')                AS dlq,
  MAX(created_at)                                       AS last_used_at
FROM email_outbox
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2;
```

## §6 — Pruning & rétention

Cron quotidien `/api/cron/email-prune` (à ajouter dans `vercel.json` ou systemd) :

| Action | Fréquence | Cible | Pourquoi |
|---|---|---|---|
| Purge `html_snapshot` + `text_snapshot` sur outbox > 90 j | quotidien | `email_outbox` | RGPD min + espace disque |
| Purge `email_event` rows > 180 j | quotidien | `email_event` | Performance |
| Purge `email_outbox` rows status='delivered' > 365 j | hebdo | `email_outbox` | RGPD (consultable seulement statistique via `mv_*`) |
| REFRESH MATERIALIZED VIEW | toutes les 5 min | `mv_email_*` | KPI dashboard |
| Sync `email_audience_link.subscriberCount` | toutes les 5 min | depuis API Listmonk | mirroir lazy |

## §7 — Diagramme des relations

```
email_template_meta ◄── email_outbox ──► email_event
       ▲                    │                ▲
       │                    │                │
       └────────────────────┼────────────────┘
                            │
email_subscriber_link ──────┼──────► email_suppression
       ▲                    │
       │                    ▼
       └── email_audience_link ◄── email_campaign_link ──► email_event
                                            │
email_automation ── email_automation_run ──┘ (via outbox_ids[])
```

## §8 — Considérations performance

- `email_outbox` peut grossir vite (toutes les semaines, 10k+ lignes). **Partitionnement déclaratif** envisagé en M6 sur `created_at` (RANGE mensuel) si > 1 M lignes.
- `email_event` est encore plus volumineux (1 outbox row → 5-10 events). Pruning agressif obligatoire.
- Tous les `WHERE status = X` couverts par index partiel `WHERE status IN ('pending', 'failed')`.
- Cron pickup query : `SELECT … FROM email_outbox WHERE status IN ('pending','failed') AND next_retry <= now() ORDER BY next_retry LIMIT 100 FOR UPDATE SKIP LOCKED` — verrouillage non-bloquant pour run concurrents.

## §9 — Références

- Schéma Listmonk officiel : https://github.com/knadh/listmonk/blob/master/schema.sql
- Drizzle Postgres docs : https://orm.drizzle.team/docs/get-started-postgresql
- Conventions Drizzle FemiGlow : `apps/web/src/db/schema/` (lecture des autres tables)
- Migration générator : `pnpm db:generate`
