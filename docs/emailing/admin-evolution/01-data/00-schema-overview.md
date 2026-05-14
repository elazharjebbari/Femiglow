# Data schema overview — M5

> Détails par table : [01-tables.md](01-tables.md). ERD : [02-erd.puml](02-erd.puml). Migrations : [03-migrations-plan.md](03-migrations-plan.md). Indexes : [04-indexes.md](04-indexes.md).

## Nouvelles tables M5

| Table | Phase | Rôle |
|---|---|---|
| `admin_email_view` | M5.1 | Vues sauvées par admin (filtres + colonnes) |
| `user_event` | M5.2 | Events utilisateur unifiés (web/email/server/admin) |
| `email_audience` | M5.3 | Définition d'une audience (rules JSON) |
| `email_audience_snapshot` | M5.3 | Snapshot figé d'une audience |
| `email_audience_snapshot_member` | M5.3 | Emails dans un snapshot |
| `lead_tag` | M5.5 | Tags manuels ou automatiques sur un lead |

## Tables modifiées M5

| Table | Phase | Modif |
|---|---|---|
| `email_campaign_link` | M5.4 | Ajout `audience_id`, `snapshot_id` |
| `email_automation.steps` (jsonb) | M5.5 | Extension : `branch`, `tag`, `update_lead`, `webhook`, `wait_for_event` |
| `email_automation` | M5.5 | Ajout `cooldown_seconds`, `quiet_hours_enabled`, `daily_cap` |
| `email_automation_run` | M5.5 | Ajout `awaiting_event_name`, `awaiting_until` |

## Tables existantes utilisées (lecture)

| Table | Rôle dans M5 |
|---|---|
| `leads` | Source identité pour audience criteria |
| `orders` | Agrégations pour commerce criteria |
| `email_outbox` | Source de la transactional |
| `email_event` | Source engagement email |
| `email_suppression` | Exclusion auto audiences |
| `email_subscriber_link` | Source consentement |
| `tracking_event_definitions` | Catalogue events pour automation triggers |
| `admin_audit_log` | Audit toutes actions admin emails |

## Principes data

### Soft delete partout
Toutes les tables M5 ont `deletedAt` (timestamptz nullable). Les
suppressions UI sont des `UPDATE deletedAt=now()`. Cron purge physique
J+90.

### Audit trail
Chaque INSERT/UPDATE/DELETE sur audiences, automations, campaigns →
INSERT dans `admin_audit_log` (existing).

### Idempotency
- Snapshot : clé `(audience_id, snapshot_key)` UNIQUE
- Push Listmonk : clé `(snapshot_id, listmonk_list_id)` UNIQUE
- Automation run : contrainte `UNIQUE (automation_id, recipient_email)
  WHERE status IN ('pending', 'running')`

### jsonb stratégique
| Colonne | Pourquoi jsonb |
|---|---|
| `email_audience.rules` | Schéma évolutif, opérateurs variés |
| `email_audience_snapshot.metadata` | Compteurs, durée build, etc. |
| `email_automation.steps` | Discriminated union, ajout types V2 |
| `email_automation_run.context` | Vars trigger payload |
| `user_event.properties` | Event-specific (extensible) |
| `admin_email_view.filter_state` | Filtres + sort + columns |

### Indexes critiques
Voir [04-indexes.md](04-indexes.md). Highlights :
- `user_event` : `(email, ts DESC)`, `(event_name, ts DESC)`,
  GIN(properties)
- `email_outbox` : `(status, createdAt DESC)`, `(toEmail, createdAt DESC)`
- `email_audience_snapshot_member` : `(snapshot_id)`, `(email)`

### Volumétrie attendue

| Table | Croissance | Volume cible à 1 an |
|---|---|---|
| `user_event` | ~10k/jour | 4M rows |
| `email_outbox` | ~1k/jour | 400k rows |
| `email_audience` | < 100 total | 100 rows |
| `email_audience_snapshot` | ~10/jour | 4k rows |
| `email_audience_snapshot_member` | ~50k/jour | 20M rows (purge J+90) |
| `email_automation_run` | ~500/jour | 200k rows |

`email_audience_snapshot_member` est la table chaude — c'est elle qui
nécessite le purge J+90 le plus strict.
