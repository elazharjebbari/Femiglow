# DB operations — Procédures Postgres

> Toutes les opérations DB (migrations, backups, recovery) suivent les mêmes principes : **dry-run d'abord, backup avant**, **toujours testé en staging**, **rollback path validé**.

## Stack

- **Postgres 15** avec extension `pgvector` 0.7+ pour embeddings.
- **Drizzle ORM** 0.45 + drizzle-kit pour migrations.
- **PgBouncer** en pooling transaction-level pour app.
- **Direct connection** (sans pgbouncer) pour migrations.

## Variables d'environnement DB

```env
# Production pooled (app)
DATABASE_URL=postgresql://...pgbouncer:5432/femiglow_prod

# Production direct (migrations, admin queries)
DATABASE_DIRECT_URL=postgresql://...:5432/femiglow_prod

# Staging
DATABASE_URL_STAGING=postgresql://...pgbouncer:5432/femiglow_staging
DATABASE_DIRECT_URL_STAGING=postgresql://...:5432/femiglow_staging
```

## Migrations Drizzle

### Créer une nouvelle migration

```bash
# 1. Modifier le schema dans lib/db/schema/
# 2. Générer la migration
npm run db:generate

# Output : drizzle/0028_<nom_auto>.sql
# Le renommer en quelque chose de sémantique :
mv drizzle/0028_some_auto_name.sql drizzle/0028_add_user_preferences.sql
```

### Vérifier dry-run

```bash
# Voir le SQL qui sera exécuté sans appliquer
DATABASE_URL=$DATABASE_DIRECT_URL_STAGING \
  npm run db:migrate:up -- --dry-run
```

### Appliquer en local

```bash
DATABASE_URL=postgresql://localhost:5432/femiglow_dev \
  npm run db:migrate:up
```

### Appliquer en staging

```bash
DATABASE_URL=$DATABASE_DIRECT_URL_STAGING \
  npm run db:migrate:up

# Vérifier état
DATABASE_URL=$DATABASE_DIRECT_URL_STAGING \
  npm run db:migrate:status
```

### Tester rollback (CRITIQUE)

```bash
# Rollback la dernière migration appliquée
DATABASE_URL=$DATABASE_DIRECT_URL_STAGING \
  npm run db:migrate:down -- --steps=1

# Vérifier que le schema est revenu en arrière proprement
DATABASE_URL=$DATABASE_DIRECT_URL_STAGING \
  npm run db:schema:diff
```

### Idempotence test (CRITIQUE)

```bash
# Re-appliquer, re-rollback 3 fois
for i in 1 2 3; do
  npm run db:migrate:up
  npm run db:migrate:down -- --steps=1
done

# Si une seule passe échoue → migration non idempotente, refuser le merge
```

### Appliquer en prod

⚠️ **Procédure deploy.md section "Étape 2 — Migrations DB"**. Ne pas appliquer directement sans deploy run.

## Backups

### Backups automatiques (Supabase / Neon)

Configurés au niveau provider :
- **Daily snapshot** automatique, retention 7 jours.
- **Point-in-time recovery** activé (jusqu'à 7 jours en arrière).
- **Weekly snapshot** archivé sur S3 Glacier, retention 1 an.

### Backup manuel pre-deploy

```bash
# Format custom (compressé, restore selectif possible)
pg_dump $DATABASE_URL_PROD \
  --format=custom \
  --no-owner \
  --no-acl \
  --exclude-table-data='chat_events' \
  --exclude-table-data='audit_logs' \
  --file=backups/femiglow_prod_pre_v5_$(date +%Y%m%d_%H%M%S).dump

# Vérifier intégrité
pg_restore --list backups/femiglow_prod_pre_v5_*.dump | head -20
```

### Restore from backup

```bash
# ⚠️ Procédure catastrophique. Voir rollback.md Type C.3.c.

# 1. Créer DB temporaire pour tester restore
createdb femiglow_restore_test

# 2. Restore vers DB temporaire
pg_restore \
  --no-owner \
  --no-acl \
  --dbname=postgresql://localhost:5432/femiglow_restore_test \
  backups/femiglow_prod_pre_v5_YYYYMMDD_HHMMSS.dump

# 3. Vérifier
psql postgresql://localhost:5432/femiglow_restore_test -c "
  SELECT 'chat_sessions', COUNT(*) FROM chat_sessions
  UNION ALL
  SELECT 'chat_messages', COUNT(*) FROM chat_messages;
"

# 4. Si vert → restore vers prod (cf. rollback.md)
```

## Maintenance routine

### Daily — Health checks (via cron)

```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity WHERE datname='femiglow_prod';

-- Size par table
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;

-- Index usage (low scan = candidat à supprimer)
SELECT schemaname, relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC LIMIT 10;
```

### Weekly — VACUUM & ANALYZE

```sql
-- VACUUM ANALYZE des tables hot
VACUUM ANALYZE chat_messages;
VACUUM ANALYZE chat_sessions;
VACUUM ANALYZE chat_events;
VACUUM ANALYZE kb_chunks;
```

### Monthly — Reindex (si fragmentation)

```sql
-- Identifier index fragmentés
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size,
       idx_scan
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
WHERE pg_relation_size(indexrelid) > 1024 * 1024 * 100  -- > 100 MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- REINDEX (locks selectifs, off-peak)
REINDEX INDEX CONCURRENTLY idx_chat_messages_session_created;
```

## Queries diagnostiques courantes

### Slow queries en cours

```sql
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

### Top 10 queries by total time (pg_stat_statements)

```sql
SELECT substring(query, 1, 80) AS query_short,
       calls,
       total_exec_time,
       mean_exec_time,
       rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

### Locks en attente

```sql
SELECT pid, mode, granted, relation::regclass, query_start, query
FROM pg_locks
JOIN pg_stat_activity USING (pid)
WHERE NOT granted;
```

### Kill une query bloquante

```sql
SELECT pg_cancel_backend(PID);   -- soft
SELECT pg_terminate_backend(PID); -- hard
```

## pgvector spécifique

### Vérifier index HNSW créé

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'kb_chunks'
  AND indexdef LIKE '%hnsw%';
```

### Tester une query d'embedding

```sql
SELECT id, content, embedding <=> '[0.1, 0.2, ...]'::vector AS distance
FROM kb_chunks
WHERE audience = 'b2c' AND language = 'fr'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### Recompute embeddings (si modèle change)

```bash
# Script utilitaire
npm run script:recompute-embeddings -- --table=kb_chunks --batch=100
# Durée : ~10 min pour 10k chunks avec OpenAI ada-002
```

## RGPD operations

### Export user data

```sql
-- Toutes les données rattachées à un session_id ou phone
WITH session_ids AS (
  SELECT DISTINCT session_id FROM chat_leads WHERE phone = '+212600000000'
)
SELECT 'sessions' AS table, jsonb_agg(s.*)
FROM chat_sessions s WHERE id IN (SELECT session_id FROM session_ids)
UNION ALL
SELECT 'messages', jsonb_agg(m.*)
FROM chat_messages m WHERE session_id IN (SELECT session_id FROM session_ids)
UNION ALL
SELECT 'leads', jsonb_agg(l.*)
FROM chat_leads l WHERE phone = '+212600000000';
```

### Forget user data (RGPD right to erasure)

```sql
BEGIN;

-- Anonymiser plutôt que delete pour préserver intégrité analytics
UPDATE chat_sessions
SET ip_redacted = NULL, user_agent_redacted = NULL
WHERE id IN (SELECT DISTINCT session_id FROM chat_leads WHERE phone = '+212600000000');

UPDATE chat_messages
SET text = '<REDACTED_GDPR_REQUEST_YYYYMMDD>'
WHERE session_id IN (SELECT DISTINCT session_id FROM chat_leads WHERE phone = '+212600000000');

DELETE FROM chat_leads WHERE phone = '+212600000000';

-- Log audit
INSERT INTO audit_logs(action, target, performed_at, performed_by)
VALUES ('gdpr_forget', 'phone:+212600000000', NOW(), 'system');

COMMIT;
```

## Performance tuning checklist

- [ ] EXPLAIN ANALYZE sur queries hot path (< 50ms p50).
- [ ] Index covering pour pattern WHERE + ORDER BY.
- [ ] Partitionnement pour `chat_events` si > 100M rows.
- [ ] PgBouncer pool_size aligné avec Vercel concurrent functions.
- [ ] HNSW index parameters tuned (m=16, ef_construction=64 par défaut).

## Anti-patterns DB

- ❌ Appliquer migration prod sans avoir testé rollback en staging.
- ❌ Backup quotidien non testé via restore.
- ❌ Index ajouté sans vérifier query plan avant/après.
- ❌ DELETE sans WHERE ou avec WHERE trop large.
- ❌ Mass UPDATE sans batch + sans transaction.
- ❌ VACUUM FULL en peak hours (table locks).
- ❌ Restore en prod sans dry-run sur DB temporaire d'abord.
