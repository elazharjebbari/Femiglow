# Indexes — stratégie & catalogue

## Principes

- **Couvrir les queries chaudes** des hooks frontend (list pages, KPI
  headers, preview audience)
- Pas d'index "au cas où" : chaque index a un coût d'écriture
- **Index partiel** (`WHERE deleted_at IS NULL`) sur les soft-delete
- **GIN** sur jsonb fréquemment filtré (`user_event.properties`)
- **CONCURRENTLY** sur les indexes ajoutés à des tables avec volume
  existant

## Catalogue par table

### admin_email_view
| Index | Cardinality | Queries servies |
|---|---|---|
| PK `id` | high | get by id |
| `idx_admin_email_view_owner (owner_email, scope)` partial `deleted_at IS NULL` | medium | list views per admin |

### user_event
| Index | Cardinality | Queries servies |
|---|---|---|
| PK `id` | very high | nothing utile (queue de bridge) |
| `idx_user_event_email_ts (email, ts DESC)` | very high | audience match per user, automation run check |
| `idx_user_event_name_ts (event_name, ts DESC)` | high | event counts global, trigger fan-out |
| `idx_user_event_session (session_id)` partial | medium | session-based analytics |
| `idx_user_event_properties_gin (properties)` GIN | high | filter on properties (e.g. cart total) |

### email_audience
| Index | Queries |
|---|---|
| PK `id` | get by id |
| Unique `slug` | resolve by slug, conflict check |

### email_audience_snapshot
| Index | Queries |
|---|---|
| PK `id` | get by id |
| `idx_snapshot_audience (audience_id, created_at DESC)` | list snapshots for audience |
| `idx_snapshot_purge (purgeable_after)` partial `listmonk_list_id IS NOT NULL` | cron purge |

### email_audience_snapshot_member
| Index | Queries |
|---|---|
| Composite PK `(snapshot_id, email)` | bulk select for push |
| `idx_member_email (email)` | search/find user in past snapshots, RGPD |

### lead_tag
| Index | Queries |
|---|---|
| PK `id` | – |
| Unique `(lead_id, tag)` | conflict check |
| `idx_lead_tag_tag (tag)` | audience filter "has tag X" |
| `idx_lead_tag_lead (lead_id)` | list tags per lead |

### email_outbox (existing — vérifier)
| Index requis | But |
|---|---|
| `(status, created_at DESC)` | list par statut + tri date |
| `(to_email, created_at DESC)` | search par destinataire |
| `(template, created_at DESC)` | filter par template |
| `(smtp_message_id)` partial | webhook dispatcher lookup |

### email_automation_run
| Index requis | But |
|---|---|
| `(automation_id, next_action_at)` | cron pick-up |
| Unique active runs `(automation_id, recipient_email) WHERE status IN ('pending','running','waiting_for_event')` | dedup trigger |
| `(awaiting_event_name, awaiting_until)` partial `status='waiting_for_event'` | event resume |

## Vérifs périodiques (runbook)

```sql
-- top 10 queries les plus lentes / fréquentes
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- index inutilisés
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname LIKE 'idx_%';
```

## Performance targets

| Query | p95 cible |
|---|---|
| List outbox (50 rows, no filter) | < 50ms |
| List outbox (filter status=failed) | < 100ms |
| Preview audience size (VIP, ~50 rows) | < 500ms |
| Preview audience size (Newsletter, ~10k rows) | < 2s |
| Snapshot 10k rows | < 30s |
| Push to Listmonk 10k rows | < 5min |
| KPI summary (last 1h) | < 100ms |
| Cron tick automation (1000 runs) | < 5s |
