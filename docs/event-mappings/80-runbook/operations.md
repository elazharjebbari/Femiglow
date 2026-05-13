# 80.5 — Opérations courantes

## Régénérer default-mapping.json depuis le code

```bash
pnpm tracking:generate-default-mapping > docs/event-mappings/20-data/default-mapping.json
```

Script à implémenter (`apps/web/scripts/generate-default-mapping.ts`) :
```typescript
// Lit MAP de event-mapping.ts → écrit en JSON conforme à default-mapping.json
```

## Vérifier drift default vs code

```bash
pnpm tracking:check-default-mapping
# exit 0 si OK, exit 1 + diff si drift
```

## Activer __default__ manuellement (1re install)

```sql
UPDATE event_mapping_versions
SET is_active = true, status = 'active', activated_at = now()
WHERE id = '__default__';
```

## Lister les versions actives par period

```sql
SELECT id, name, activated_at, archived_at,
       EXTRACT(EPOCH FROM (COALESCE(archived_at, now()) - activated_at))/3600 AS hours_active
FROM event_mapping_versions
WHERE activated_at IS NOT NULL
ORDER BY activated_at DESC;
```

## Récupérer le contenu d'une version archivée

```sql
SELECT mappings FROM event_mapping_versions WHERE id = 'emv_xxx';
```

Export en fichier :
```bash
psql -t -c "SELECT jsonb_pretty(mappings) FROM event_mapping_versions WHERE id = 'emv_xxx'" \
  > emv_xxx_export.json
```

## Forcer un reset hard (cas extrême ops)

Si l'API admin est cassée mais la DB ok :
```sql
BEGIN;
UPDATE event_mapping_versions SET is_active = false, status = 'archived', archived_at = now()
WHERE is_active = true;
UPDATE event_mapping_versions SET is_active = true, status = 'active', activated_at = now()
WHERE id = '__default__';
COMMIT;
```

## Purge versions deleted > 90 jours (cron V2)

```sql
DELETE FROM event_mapping_versions
WHERE status = 'deleted' AND deleted_at < now() - interval '90 days'
  AND is_default = false AND is_active = false;
```

(V2 — script automatisé)

## Backup ciblé du module

```bash
# Backup seulement les tables event_mapping_*
pg_dump "$DATABASE_URL" -Fc \
  -t event_mapping_versions -t event_mapping_audit \
  -f /var/backups/femiglow/event-mappings-$(date +%F).dump
```

## Restore ciblé

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists \
  -t event_mapping_versions -t event_mapping_audit \
  /var/backups/femiglow/event-mappings-2026-05-13.dump
```

## Audit log query — qui a fait quoi quand

```sql
SELECT
  to_char(created_at, 'YYYY-MM-DD HH24:MI') AS when,
  actor_id, action, version_id,
  meta->>'env' AS env,
  meta->'diffSummary'->>'changed' AS changes_count
FROM event_mapping_audit
WHERE created_at >= now() - interval '7 days'
ORDER BY created_at DESC;
```

## Monitoring queries

### Cache hit rate (depuis logs)

```bash
# Sur prod, derniers 1h
journalctl -u femiglow.service --since '1 hour ago' \
  | grep 'tracking.event_mapping.cache_' \
  | awk '{ if (/hit/) h++; else m++ } END { printf "hit=%d miss=%d rate=%.1f%%\n", h, m, h*100/(h+m) }'
```

### Validation failures par admin

```bash
journalctl -u femiglow.service --since '24 hours ago' \
  | grep 'tracking.event_mapping.validation_failed' \
  | jq -r '.actor_id' \
  | sort | uniq -c | sort -rn
```
