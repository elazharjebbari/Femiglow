# 05 — Observabilité (logs, métriques, alertes)

> Objectif : pouvoir **déboguer** un lead de bout en bout et **piloter** le rollout
> avec des signaux fiables, sans PII.

## 1. Logs structurés (sans PII : ids, scopes, statuts uniquement)

| Événement | Émis par | Champs |
|---|---|---|
| `owbs.queue.enqueue` | lead-sync-queue | `mutationId, leadId, scope` |
| `owbs.queue.flush` | lead-sync-queue | `mutationId, scope, attempt, durationMs, ok` |
| `owbs.queue.retry` | lead-sync-queue | `mutationId, scope, attempt, backoffMs, status` |
| `owbs.queue.dropped` | lead-sync-queue | `mutationId, scope, reason(conflict\|max_attempts\|4xx)` |
| `owbs.beacon.sent` | beacon-flush | `count, sentVia` |
| `owbs.lead.upsert` | lead-service | `leadId, scope, replayed, created(bool)` |
| `owbs.outbox.enqueue` | lead-outbox-repo | `id, type, leadId, dedupeKey` |
| `owbs.outbox.done` | processor | `id, type, attempts, durationMs` |
| `owbs.outbox.reschedule` | processor | `id, type, attempts, nextAttemptAt, errorClass` |
| `owbs.outbox.dead` | processor | `id, type, attempts, errorClass` |

Corrélation : `leadId` est la **clé de trace** transverse client→serveur→worker.

## 2. Métriques (dérivées des logs / requêtes SQL)

| Métrique | Définition | Cible / seuil |
|---|---|---|
| `transition_p95_ms` | clic→affichage étape suivante (RUM client) | < 50 ms |
| `lead_loss_rate` | leads validés sans row serveur (recoupement enqueue vs upsert + beacon) | 0 |
| `sync_retry_rate` | retries / envois | < 10 % (alerte si pic) |
| `sync_409_rate` | 409 / envois | bas/stable |
| `outbox_pending` | `count(*) WHERE status='pending'` | borné (< seuil) |
| `outbox_dead` | `count(*) WHERE status='dead'` | 0 |
| `outbox_drain_p95_ms` | enqueue→done | < 90 000 ms |
| `dup_rate_capi` / `dup_rate_webhook` | événements dédupliqués par event_id | ≈ 0 |
| `checkout_abandon_rate` | abandons / sessions checkout | ≤ baseline (objectif : ↓) |

## 3. Alertes

| Alerte | Condition | Sévérité | Action |
|---|---|---|---|
| Outbox backlog | `outbox_pending > seuil` pendant > 5 min | high | inspecter handler/origine, cadence cron |
| Outbox dead | `outbox_dead > 0` | high | triage row dead, corriger, rejouer |
| Retry storm | `sync_retry_rate` > seuil | medium | vérifier origine/latence, capacité DB |
| Perte de lead | `lead_loss_rate > 0` | critical | vérifier beacon (WebKit/R-07), kill-switch si besoin |
| Hausse abandon | `checkout_abandon_rate` > baseline+δ | high | go/no-go rollout, rollback éventuel |

## 4. Dashboards (panneaux)
- **Funnel checkout** : étapes, taux de passage, abandon (avant/après flag).
- **File client (RUM)** : transition_p95, retry_rate, dropped, beacon_sent.
- **Outbox** : pending/processing/done/dead, drain_p95, top errorClass.
- **Qualité événements** : dup_rate CAPI/webhook, 409_rate.

## 5. Débogage d'un lead (procédure)
1. Récupérer le `leadId` (cl_…).
2. Logs client : `owbs.queue.*` pour ce `leadId` (envoi/retry/drop/beacon).
3. DB : `SELECT * FROM chat_lead WHERE id='cl_…'` (état + timestamps).
4. Outbox : `SELECT * FROM lead_event_outbox WHERE lead_id='cl_…'` (effets + statut + last_error).
5. Idempotence : `SELECT * FROM checkout_idempotency WHERE resource_id='cl_…'`.
6. Conclure : étape bloquante (UI/transport/serveur/handler) localisée par la trace.
