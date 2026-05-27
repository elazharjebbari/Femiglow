# SQL d'audit

## 1. État avant fix

```sql
-- Inventaire pages
SELECT slug, title, status, length(body_md) AS body_size
FROM legal_pages ORDER BY title;

-- Inventaire vars
SELECT key, is_required, value IS NOT NULL AND value != '' AS filled
FROM legal_template_vars ORDER BY key;

-- Drift detection
WITH used AS (
  SELECT DISTINCT regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug NOT LIKE 'e2e%'
)
SELECT m[1] AS used_var,
       EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1]) AS in_db,
       m[1] IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION') AS is_preset
FROM used
WHERE NOT EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1])
  AND m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
ORDER BY 1;
-- Attendu pré-fix : 7-8 vars (CONTACT_EMAIL, HOST_*, SUPPORT_HOURS, etc.)
-- Attendu post-fix : 0 rows
```

## 2. État post-migration

```sql
-- Coverage : vars utilisées dans templates couvertes par DB ou presets
WITH used AS (
  SELECT slug, regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE slug NOT LIKE 'e2e%'
)
SELECT slug,
       array_agg(DISTINCT m[1]) AS vars_used,
       COUNT(DISTINCT m[1]) FILTER (
         WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
           AND NOT EXISTS (SELECT 1 FROM legal_template_vars WHERE key = m[1])
       ) AS drift_count
FROM used
GROUP BY slug
ORDER BY drift_count DESC, slug;
```

## 3. Pages publiées exposant des vars sensibles

```sql
-- Détecte les pages publiées contenant {{ICE}} ou {{COMPANY_RC}} en clair
SELECT slug, status,
       body_md LIKE '%{{ICE}}%' AS has_ice,
       body_md LIKE '%{{COMPANY_RC}}%' AS has_rc,
       body_md LIKE '%{{COMPANY_ADDRESS}}%' AS has_address
FROM legal_pages
WHERE status = 'published'
  AND (body_md LIKE '%{{ICE}}%'
       OR body_md LIKE '%{{COMPANY_RC}}%'
       OR body_md LIKE '%{{COMPANY_ADDRESS}}%')
ORDER BY slug;
```

## 4. Pages bloquées au publish

```sql
-- Pages avec status=draft qui utilisent des vars manquantes (post-migration)
WITH page_vars AS (
  SELECT slug, body_md,
         regexp_matches(body_md, '\{\{([A-Z][A-Z0-9_]*)\}\}', 'g') AS m
  FROM legal_pages WHERE status = 'draft' AND slug NOT LIKE 'e2e%'
)
SELECT slug, array_agg(DISTINCT m[1]) FILTER (
  WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
    AND NOT EXISTS (SELECT 1 FROM legal_template_vars v WHERE v.key = m[1])
) AS missing_vars
FROM page_vars
GROUP BY slug
HAVING array_length(array_agg(DISTINCT m[1]) FILTER (
  WHERE m[1] NOT IN ('LAST_UPDATED','CURRENT_YEAR','SITE_URL','VERSION')
    AND NOT EXISTS (SELECT 1 FROM legal_template_vars v WHERE v.key = m[1])
), 1) > 0;
```

## 5. Cleanup candidates E2E

```sql
SELECT slug, status, created_at, age(created_at) AS age
FROM legal_pages
WHERE slug LIKE 'e2e-test-%'
  AND status = 'draft'
ORDER BY created_at;
```

## 6. Vars inutilisées

```sql
-- Vars définies mais jamais référencées dans aucun body_md
SELECT key, label, is_required
FROM legal_template_vars
WHERE NOT EXISTS (
  SELECT 1 FROM legal_pages
  WHERE body_md LIKE '%{{' || key || '}}%'
)
ORDER BY key;
```

Attendu : peut inclure COMPANY_PATENTE, COMPANY_TVA, DPO_EMAIL (vars définies mais non utilisées dans les templates actuels).

## 7. Audit cohérence — script monitoring

```sql
-- À exécuter en cron weekly ou via /api/admin/legal/audit endpoint
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM legal_pages WHERE status = 'published') AS published,
    (SELECT COUNT(*) FROM legal_pages WHERE status = 'draft' AND slug NOT LIKE 'e2e%') AS drafts,
    (SELECT COUNT(*) FROM legal_pages WHERE slug LIKE 'e2e-test-%') AS e2e_orphans,
    (SELECT COUNT(*) FROM legal_template_vars) AS total_vars,
    (SELECT COUNT(*) FROM legal_template_vars WHERE is_required AND (value IS NULL OR value = '')) AS vars_required_empty
)
SELECT json_build_object(
  'timestamp', NOW()::text,
  'published', published,
  'drafts', drafts,
  'e2e_orphans', e2e_orphans,
  'total_vars', total_vars,
  'vars_required_empty', vars_required_empty,
  'health_score', CASE
    WHEN vars_required_empty = 0 AND e2e_orphans = 0 THEN 'OK'
    WHEN vars_required_empty > 0 OR e2e_orphans > 10 THEN 'WARN'
    ELSE 'OK'
  END
) FROM stats;
```

## 8. Vérification "info sur demande" présent

```sql
-- Détecte les pages publiées qui contiennent le bloc anonymisé
SELECT slug,
       body_md LIKE '%legal@femiglow-maroc.com%' AS has_legal_email,
       body_md LIKE '%information%sur demande%' AS has_info_phrase
FROM legal_pages
WHERE status = 'published'
ORDER BY slug;
```

Attendu post-refonte : `has_legal_email = true` pour mentions-legales, cgv, confidentialite, retours.
