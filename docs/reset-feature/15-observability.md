# 15 — Observabilité (logs, metrics, audit, SSE)

## Logs structurés

Format JSON Lines, écrit sur stdout (capturé par journald via le service systemd) :

```json
{
  "ts": "2026-05-13T08:15:23.117Z",
  "level": "info",
  "component": "reset.orchestrator",
  "jobId": "rst_abcdef123456",
  "actorId": "adm_xxxxxxxxxxxxxxxx",
  "phase": "backup",
  "step": "pg_dump.start",
  "message": "pg_dump start",
  "meta": { "dumpedFrom": "femiglow", "targetPath": "/var/backups/femiglow/bkp_…/db.sql" },
  "durationMs": null
}
```

### Niveaux

| Level | Usage                                                                        |
|-------|------------------------------------------------------------------------------|
| trace | très verbeux (off prod par défaut, on via `LOG_LEVEL=trace`)                 |
| debug | détails internes utiles au debug                                             |
| info  | événements normaux : phase start/end, audit                                  |
| warn  | non bloquant mais notable (média orphelin, seed non critique en échec)       |
| error | erreur classifiée (cf. `10-error-taxonomy.md`)                               |
| fatal | rollback failure, état critique                                              |

### Filtre journald

```bash
# Tous les logs reset du jour
journalctl -u femiglow.service --since today | grep '"component":"reset'

# Erreurs uniquement
journalctl -u femiglow.service --since today | grep '"level":"error"' | grep reset

# Logs d'un job spécifique
JOB=rst_abcdef123456
journalctl -u femiglow.service --since today | grep "\"jobId\":\"$JOB\""
```

## Audit log (DB)

Une entrée `audit_events` par phase + 2 entrées englobantes :

| Action                       | Quand                       | Meta                                                  |
|------------------------------|-----------------------------|--------------------------------------------------------|
| `reset.run.start`            | début POST /run             | `{ mode, plan, configHash }`                          |
| `reset.preflight`            | fin phase                   | `{ durationMs, warnings, plan }`                      |
| `reset.backup`               | fin phase                   | `{ durationMs, backupId, dbSize, mediaSize, sha256 }` |
| `reset.audit-counts`         | fin phase                   | `{ durationMs, rowCounts }`                           |
| `reset.wipe-db`              | fin phase                   | `{ durationMs, droppedTables, strategy }`             |
| `reset.wipe-media`           | fin phase                   | `{ durationMs, removedDirs, freedBytes }`             |
| `reset.wipe-cache`           | fin phase                   | `{ durationMs }`                                       |
| `reset.migrate`              | fin phase                   | `{ durationMs, appliedMigrations }`                   |
| `reset.seed`                 | fin phase                   | `{ durationMs, completed, skipped, errors }`          |
| `reset.verify`               | fin phase                   | `{ durationMs, passed, failed, checks }`              |
| `reset.cleanup-backups`      | fin phase                   | `{ durationMs, pruned, kept }`                        |
| `reset.run.complete`         | fin job (success)           | `{ durationMs, summary, allPhases }`                  |
| `reset.run.failed`           | fin job (failure)           | `{ durationMs, errorCode, phaseFailed, rolledBack }`  |
| `reset.rollback.start`       | début rollback              | `{ backupId, reason }`                                |
| `reset.rollback.complete`    | fin rollback (success)      | `{ durationMs, restoredFrom }`                        |
| `reset.rollback.failed`      | rollback échoué (fatal)     | `{ errorCode, recoveryCommand }`                      |
| `reset.restore.start`        | restore CLI/UI              | `{ backupId, actorId }`                               |
| `reset.restore.complete`     | restore terminé             | `{ durationMs, backupId, sha256Verified }`            |

`actorId` est l'admin déclencheur (ou null si CLI sans session).

Requête type :
```sql
SELECT action, created_at, meta->>'durationMs' as duration_ms,
       meta->>'mode' as mode, meta->>'errorCode' as error_code
FROM audit_events
WHERE action LIKE 'reset.%'
ORDER BY created_at DESC
LIMIT 30;
```

## SSE Event Stream

Endpoint : `GET /api/admin/reset/jobs/{jobId}/stream`

### Format

```
event: phase.start
data: {"phase":"backup","label":"Backup","estimatedMs":15000,"index":2,"total":10}

event: phase.progress
data: {"phase":"backup","label":"Dump SQL","fraction":0.4}

event: phase.complete
data: {"phase":"backup","durationMs":14823,"stats":{"backupId":"bkp_…","dbSize":47284921},"summary":"Backup bkp_… · 158 MB"}

event: keepalive
data: {"ts":"2026-05-13T08:15:38.000Z"}

event: phase.error
data: {"phase":"migrate","error":{"code":"MIGRATE_FAILED","message":"…","critical":true},"durationMs":4128}

event: rollback.start
data: {"backupId":"bkp_…","reason":"phase.migrate failed"}

event: rollback.complete
data: {"backupId":"bkp_…","durationMs":12300,"restored":{"db":true,"media":true}}

event: job.complete
data: {"durationMs":92847,"summary":{...},"verifyReport":{"passed":9,"failed":0}}

event: job.failed
data: {"errorCode":"MIGRATE_FAILED","phaseFailed":"migrate","rolledBack":true}
```

### Keepalive

Toutes les 15 s : event `keepalive`. Sert à :
- Maintenir la connexion ouverte derrière proxies/load balancers.
- Permettre au client de détecter une rupture (timeout > 30 s sans event ⇒ reconnect).

### Replay

Si le client se reconnecte (refresh / nouvelle connexion EventSource), le job-store
ré-émet tous les events bufférisés du job (max 500). L'UI doit dédupliquer par
`(phase, type, ts)` si elle a déjà reçu certains.

## Metrics (optionnel, V2)

Si l'env a Prometheus / OTLP exporter :

| Metric                                          | Type      | Labels                              |
|-------------------------------------------------|-----------|-------------------------------------|
| `femiglow_reset_runs_total`                     | counter   | `mode`, `status` (completed/failed) |
| `femiglow_reset_phase_duration_seconds`         | histogram | `phase`, `status`                   |
| `femiglow_reset_rollback_total`                 | counter   | `reason`                            |
| `femiglow_reset_backup_size_bytes`              | gauge     | `backup_id`                         |
| `femiglow_reset_lock_acquisition_fail_total`    | counter   | —                                   |
| `femiglow_reset_concurrent_runs`                | gauge     | —                                   |

Tracé via `next-otel` ou simple prom client. Pas requis V1.

## Diagnostic en cas d'incident

### "Le reset rame, est-il bloqué ?"

```bash
# Voir le job actif
curl -sS -b "$JAR" http://127.0.0.1:8011/api/admin/reset/jobs/active | jq

# Voir les logs récents du reset
journalctl -u femiglow.service --since '5 min ago' | grep reset | tail -50

# Voir la phase courante
psql "$DATABASE_URL" -c "
  SELECT action, created_at FROM audit_events
  WHERE action LIKE 'reset.%' ORDER BY created_at DESC LIMIT 1;"
```

### "Le reset a planté, où en suis-je ?"

```bash
# Dernier job dans audit
psql "$DATABASE_URL" -c "
  SELECT action, meta->>'errorCode' as error, meta->>'phaseFailed' as phase
  FROM audit_events
  WHERE action IN ('reset.run.complete','reset.run.failed','reset.rollback.complete','reset.rollback.failed')
  ORDER BY created_at DESC LIMIT 5;"

# Inspect job snapshot in memory (si serveur encore up)
curl -sS -b "$JAR" http://127.0.0.1:8011/api/admin/reset/jobs/<jobId> | jq
```

### "Trouver le backup correspondant"

```bash
# Backups par date desc
ls -lt /var/backups/femiglow/

# Manifest d'un backup
cat /var/backups/femiglow/bkp_…/manifest.json | jq
```

## Rétention

| Élément               | Rétention       | Configurable                                |
|-----------------------|-----------------|---------------------------------------------|
| Logs (journald)       | Politique OS    | `journalctl` rotation                       |
| audit_events DB       | Indéfini        | À purger > 90 j manuellement (V2)           |
| Backups disque        | `keepBackups`   | Config CLI/UI, default 5                    |
| SSE events buffer     | 500 max / job   | Const `MAX_BUFFERED_EVENTS`                 |
| Job-store mémoire     | 1 h TTL         | Const `JOB_TTL_MS`                          |

## Privacy / PII

Les logs et l'audit log peuvent contenir :
- `actorId`, `actorEmail` (admin → OK, c'est lui qui consulte)
- `backupId`, `gitCommit`, `hostname` (non sensible)
- Métadonnées de phases (rowCounts, durations → non sensible)

Aucune donnée utilisateur final n'est loguée hors agrégats. Les backups SQL contiennent
naturellement la PII de la DB — protégés par permissions FS (`0700`).
