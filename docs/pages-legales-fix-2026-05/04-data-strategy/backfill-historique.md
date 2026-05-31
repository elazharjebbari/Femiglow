# Backfill data — procédure complète

## Étape 1 — Audit pré-migration

```bash
# Snapshot DB
psql $DATABASE_URL -t -A -c "
SELECT json_build_object(
  'timestamp', NOW()::text,
  'env', 'local',
  'note', 'Pre-migration 0075',
  'total_pages', (SELECT COUNT(*) FROM legal_pages),
  'pages_by_status', (SELECT json_object_agg(status, n) FROM (SELECT status, COUNT(*) AS n FROM legal_pages GROUP BY 1) t),
  'e2e_orphans', (SELECT COUNT(*) FROM legal_pages WHERE slug LIKE 'e2e-test-%'),
  'total_vars', (SELECT COUNT(*) FROM legal_template_vars),
  'vars_filled', (SELECT COUNT(*) FROM legal_template_vars WHERE value IS NOT NULL AND value != ''),
  'vars_required_empty', (SELECT COUNT(*) FROM legal_template_vars WHERE is_required = true AND (value IS NULL OR value = '')),
  'vars_by_key', (SELECT json_object_agg(key, value IS NOT NULL AND value != '') FROM legal_template_vars)
)
" > docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/pre-migration.json
cat docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/pre-migration.json | jq
```

## Étape 2 — Migration

```bash
# Appliquer migration SQL
pnpm db:migrate-safe

# Ou directement (si migration safe ne pick pas 0075)
psql $DATABASE_URL -f apps/web/drizzle/migrations/0075_legal_vars_rename_and_add.sql
```

## Étape 3 — Vérification post-migration

```bash
# Verify rename
psql $DATABASE_URL -c "
SELECT key FROM legal_template_vars
 WHERE key IN ('CONTACT_EMAIL','CONTACT_PHONE','HOST_ADDRESS','HOST_NAME','HOST_CONTACT','CNDP_DECLARATION_REF');
" 2>&1 | head -10
# Attendu : 6 rows

# Verify inserts
psql $DATABASE_URL -c "
SELECT key, value, is_required FROM legal_template_vars
 WHERE key IN ('COOLING_OFF_DAYS','CURRENCY','DATA_RETENTION_YEARS','DELIVERY_PARTNER','PAYMENT_PROVIDERS','SUPPORT_HOURS');
"
# Attendu : 6 rows

# Verify legacy disparu
psql $DATABASE_URL -c "
SELECT key FROM legal_template_vars
 WHERE key IN ('COMPANY_EMAIL','COMPANY_PHONE','HOSTING_ADDRESS','HOSTING_NAME','HOSTING_PHONE','CNDP_DECLARATION');
"
# Attendu : 0 rows
```

## Étape 4 — Cleanup E2E orphelins

### Via SQL direct

```sql
-- D'abord lister
SELECT slug, status, created_at, age(created_at) FROM legal_pages
 WHERE slug LIKE 'e2e-test-%' AND status = 'draft'
 ORDER BY created_at;

-- Si OK, supprimer (FK history possibles — vérifier)
SELECT COUNT(*) FROM legal_pages_history h
  JOIN legal_pages p ON p.id = h.page_id
 WHERE p.slug LIKE 'e2e-test-%';
-- Si 0 : OK

DELETE FROM legal_pages
 WHERE slug LIKE 'e2e-test-%' AND status = 'draft';
```

### Via endpoint admin

```bash
# Dry run d'abord
curl -X DELETE -H "cookie: <admin>" -H 'content-type: application/json' \
  -d '{"dryRun":true,"olderThanDays":7}' \
  http://localhost:3001/api/admin/legal/cleanup-e2e | jq

# Si candidates raisonnable :
curl -X DELETE -H "cookie: <admin>" -H 'content-type: application/json' \
  -d '{"dryRun":false,"olderThanDays":7}' \
  http://localhost:3001/api/admin/legal/cleanup-e2e | jq
```

## Étape 5 — Snapshot post-migration

```bash
psql $DATABASE_URL -t -A -c "
SELECT json_build_object(
  'timestamp', NOW()::text,
  'env', 'local',
  'note', 'Post-migration 0075 + cleanup E2E',
  'total_pages', (SELECT COUNT(*) FROM legal_pages),
  'e2e_orphans_remaining', (SELECT COUNT(*) FROM legal_pages WHERE slug LIKE 'e2e-test-%'),
  'total_vars', (SELECT COUNT(*) FROM legal_template_vars),
  'vars_by_key', (SELECT json_object_agg(key, value IS NOT NULL AND value != '') FROM legal_template_vars),
  'drift_check', (
    SELECT json_agg(used) FROM (
      WITH used_vars AS (
        SELECT DISTINCT regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
        FROM legal_pages WHERE slug NOT LIKE 'e2e-test-%'
      )
      SELECT m[1] AS used FROM used_vars
       WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
         AND NOT EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1])
    ) t
  )
)
" > docs/pages-legales-fix-2026-05/04-data-strategy/snapshots/post-migration.json
```

Attendu : `drift_check` est `null` ou `[]` (plus aucun drift).

## Étape 6 — Republish pages avec nouveaux templates

Pour chaque page modifiée (mentions-legales, cgv, confidentialite, retours-remboursements) :

1. Admin → édit page
2. Coller nouveau body_md
3. Save
4. Publish (avec confirm "PUBLIER")

Cf. [`02-backend/templates-refonte.md`](../02-backend/templates-refonte.md) pour le contenu exact.

## Rollback complet

Si migration cause des problèmes :

```sql
-- Step 1 : flag off d'abord
-- Set LEGAL_VARS_V2=false dans .env, redéploy

-- Step 2 : reverse rename
UPDATE legal_template_vars SET key = 'COMPANY_EMAIL' WHERE key = 'CONTACT_EMAIL';
UPDATE legal_template_vars SET key = 'COMPANY_PHONE' WHERE key = 'CONTACT_PHONE';
UPDATE legal_template_vars SET key = 'HOSTING_ADDRESS' WHERE key = 'HOST_ADDRESS';
UPDATE legal_template_vars SET key = 'HOSTING_NAME' WHERE key = 'HOST_NAME';
UPDATE legal_template_vars SET key = 'HOSTING_PHONE' WHERE key = 'HOST_CONTACT';
UPDATE legal_template_vars SET key = 'CNDP_DECLARATION' WHERE key = 'CNDP_DECLARATION_REF';

-- Step 3 : supprimer les vars ajoutées
DELETE FROM legal_template_vars
 WHERE key IN ('COOLING_OFF_DAYS','CURRENCY','DATA_RETENTION_YEARS','DELIVERY_PARTNER','PAYMENT_PROVIDERS','SUPPORT_HOURS');

-- Step 4 : revert pages publiées via history table (optionnel)
-- Récupérer la version précédente depuis legal_pages_history
```

## Estimation timings

- Migration locale (DB Postgres locale) : < 100ms
- Migration staging Neon : < 500ms
- Migration prod Neon : < 500ms
- Cleanup E2E (5 rows) : < 50ms
- Total : ~1 seconde par environnement
