# Indexes

Catalogue des indexes, justifications et requêtes principales servies.

## Légende

- **PK** : clé primaire (B-tree implicite).
- **UQ** : unicité (avec ou sans condition partielle).
- **B-tree** : tri / recherche d'égalité / range.
- **GIN** : array containment ou full-text.

## admin_users

| Index | Type | Justification |
|---|---|---|
| `admin_users_pkey` | PK | identifié par id |
| `admin_users_email_unique` | UQ partiel sur `LOWER(email) WHERE deleted_at IS NULL` | unicité email actif, lookup login |

Requête servie : `SELECT * FROM admin_users WHERE LOWER(email) = $1 AND deleted_at IS NULL`.

## admin_login_attempts

| Index | Type | Justification |
|---|---|---|
| `admin_login_attempts_ip_idx` | B-tree (ip, created_at DESC) | windowing par IP |
| `admin_login_attempts_email_idx` | B-tree (email, created_at DESC) | windowing par email |

Requête : `SELECT count(*) FROM ... WHERE ip = $1 AND created_at > NOW() - INTERVAL '15 minutes'`.

## rate_limit_counters

| Index | Type | Justification |
|---|---|---|
| `rate_limit_counters_scope_idx` | B-tree (scope, created_at DESC) | comptage par scope dans fenêtre |

## leads

| Index | Type | Justification |
|---|---|---|
| `leads_pkey` | PK | détail par id |
| `leads_created_at_idx` | B-tree DESC | tri par date (page liste, pagination cursor) |
| `leads_status_created_at_idx` | B-tree partiel `WHERE deleted_at IS NULL` | filtre statut + tri |
| `leads_type_idx` | B-tree partiel | filtre type |
| `leads_email_idx` | B-tree (LOWER(email)) partiel | recherche par email |
| `leads_search_idx` | GIN tsvector | recherche full-text français |

Requêtes principales :
- Liste filtrée + paginée : `WHERE status IN (...) AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`.
- Recherche : `WHERE search @@ plainto_tsquery('french', $1) AND deleted_at IS NULL`.

## orders

| Index | Type | Justification |
|---|---|---|
| `orders_pkey` | PK | |
| `orders_lead_id_idx` | B-tree | jointure inverse lead → order |

## order_items

| Index | Type | Justification |
|---|---|---|
| `order_items_pkey` | PK | |
| `order_items_order_id_idx` | B-tree | tous les items d'une commande |

## lead_events

| Index | Type | Justification |
|---|---|---|
| `lead_events_pkey` | PK | |
| `lead_events_lead_id_idx` | B-tree (lead_id, created_at DESC) | timeline d'un lead |

## webhook_endpoints

| Index | Type | Justification |
|---|---|---|
| `webhook_endpoints_pkey` | PK | |
| `webhook_url_unique` | UQ partiel `(url, deleted_at)` `NULLS NOT DISTINCT` | unicité URL active |
| `webhook_endpoints_active_idx` | B-tree partiel | enqueue() filtre `active=true AND deleted_at IS NULL` |
| `webhook_endpoints_events_idx` | GIN sur `events[]` partiel | enqueue() : `events @> ARRAY['lead.created']` |

## webhook_deliveries

**Index critique** :

| Index | Type | Justification |
|---|---|---|
| `webhook_deliveries_pending_idx` | B-tree (next_attempt_at) `WHERE status='pending'` | cron tick : trouve les livraisons à émettre |
| `webhook_deliveries_endpoint_created_idx` | B-tree (endpoint_id, created_at DESC) | listing détaillé d'un endpoint |
| `webhook_deliveries_status_created_idx` | B-tree (status, created_at DESC) | filtres par statut sur la page deliveries |

Requête cron critique :

```sql
SELECT * FROM webhook_deliveries
WHERE status = 'pending'
  AND next_attempt_at <= NOW()
ORDER BY next_attempt_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

Plan attendu : `Index Scan` sur `webhook_deliveries_pending_idx`,
< 5 ms même à 100k lignes (partial index = très petit).

## audit_events

| Index | Type | Justification |
|---|---|---|
| `audit_events_pkey` | PK | |
| `audit_events_actor_idx` | B-tree (actor_id, created_at DESC) | "que fait cette admin ?" |
| `audit_events_target_idx` | B-tree (target_type, target_id, created_at DESC) | "qui a touché à ce lead ?" |
| `audit_events_action_idx` | B-tree (action, created_at DESC) | filtrage par action (debug) |

## Stratégie de réindexation

- Pas de `REINDEX` programmé v1 (volumes faibles, autovacuum suffit).
- Surveillance `pg_stat_user_indexes` : si un index n'est jamais
  utilisé en 3 mois, candidat à suppression.

## EXPLAIN ANALYZE pour valider

À chaque ajout d'index, exécuter `EXPLAIN ANALYZE` sur la requête
typique avant/après. Noter le résultat dans la PR.
