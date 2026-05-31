# SQL d'audit prêts à coller

> Toutes les queries utilisables via `psql $DATABASE_URL -c "..."` ou via la console admin SQL si elle existe.

## 1. État avant fix

```sql
-- 1.1 Compteurs basiques
SELECT
  (SELECT COUNT(*) FROM chat_session) AS total_sessions,
  (SELECT COUNT(*) FROM chat_message) AS total_messages,
  (SELECT COUNT(*) FROM chat_lead) AS total_leads;

-- 1.2 Sessions par préfixe d'ID
SELECT
  LEFT(id, 3) AS prefix,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE page IS NULL) AS page_null,
  COUNT(*) FILTER (WHERE page IS NOT NULL) AS page_set,
  COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS converted
FROM chat_session
GROUP BY 1
ORDER BY n DESC;

-- 1.3 Leads par source
SELECT
  source,
  COUNT(*) AS n,
  COUNT(*) FILTER (WHERE outcome = 'converted') AS converted,
  COUNT(*) FILTER (WHERE outcome = 'pending') AS pending
FROM chat_lead
GROUP BY 1
ORDER BY n DESC;

-- 1.4 Cohérence kind/source (manuelle via préfixe — pré-migration)
SELECT
  CASE
    WHEN s.id LIKE 'cs\_%' ESCAPE '\' THEN 'chat (inferred)'
    WHEN s.id LIKE 's\_%' ESCAPE '\' THEN 'wizard_pivot (inferred)'
    ELSE 'other'
  END AS inferred_kind,
  l.source,
  COUNT(*) AS n
FROM chat_session s
JOIN chat_lead l ON l.session_id = s.id
GROUP BY 1, 2
ORDER BY 3 DESC;
```

## 2. État après migration (immédiat)

```sql
-- 2.1 Distribution kind
SELECT kind, COUNT(*) AS n
FROM chat_session
GROUP BY 1
ORDER BY 2 DESC;
-- Attendu :
-- chat         | ~XX
-- wizard_pivot | ~XX
-- system       | 0 (rare)

-- 2.2 Vérif backfill réussi
SELECT
  COUNT(*) FILTER (WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'chat') AS s_prefix_chat_BAD,
  COUNT(*) FILTER (WHERE id LIKE 'cs\_%' ESCAPE '\' AND kind = 'wizard_pivot') AS cs_prefix_wizard_BAD,
  COUNT(*) FILTER (WHERE id LIKE 's\_%' ESCAPE '\' AND kind = 'wizard_pivot') AS s_prefix_wizard_OK,
  COUNT(*) FILTER (WHERE id LIKE 'cs\_%' ESCAPE '\' AND kind = 'chat') AS cs_prefix_chat_OK
FROM chat_session;
-- Attendu : BAD = 0, OK = lignes existantes

-- 2.3 Cohérence kind ↔ source
SELECT s.kind, l.source, COUNT(*) AS n
FROM chat_session s
JOIN chat_lead l ON l.session_id = s.id
GROUP BY 1, 2
ORDER BY 3 DESC;
```

## 3. Validation comportementale (par query admin)

```sql
-- 3.1 Sessions visibles dans /admin/chat/conversations (après fix)
SELECT COUNT(*) AS visible_conversations
FROM chat_session s
WHERE s.kind = 'chat'
  AND EXISTS (
    SELECT 1 FROM chat_message m
    WHERE m.session_id = s.id
      AND m.role = 'user'
      AND m.status = 'sent'
  );

-- 3.2 Leads visibles dans /admin/chat/leads (après fix)
SELECT COUNT(*) AS visible_chat_leads
FROM chat_lead
WHERE source IN ('chat_widget', 'inline');

-- 3.3 Comparaison avant/après
SELECT
  (SELECT COUNT(*) FROM chat_session) AS total_sessions_before,
  (SELECT COUNT(*) FROM chat_session WHERE kind = 'chat' AND EXISTS (
    SELECT 1 FROM chat_message m WHERE m.session_id = chat_session.id AND m.role = 'user' AND m.status = 'sent'
  )) AS visible_sessions_after,
  (SELECT COUNT(*) FROM chat_lead) AS total_leads_before,
  (SELECT COUNT(*) FROM chat_lead WHERE source IN ('chat_widget', 'inline')) AS visible_leads_after;
```

## 4. Audit ghosts orphelins (cleanup candidates)

```sql
-- 4.1 Ghosts wizard sans lead lié > 30j
SELECT
  s.id,
  s.opened_at,
  s.page,
  EXTRACT(EPOCH FROM (NOW() - s.opened_at)) / 86400 AS age_days
FROM chat_session s
WHERE s.kind = 'wizard_pivot'
  AND s.status = 'open'
  AND s.opened_at < NOW() - INTERVAL '30 days'
  AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id)
ORDER BY s.opened_at ASC
LIMIT 50;

-- 4.2 Compteur
SELECT COUNT(*) AS cleanup_candidates
FROM chat_session s
WHERE s.kind = 'wizard_pivot'
  AND s.status = 'open'
  AND s.opened_at < NOW() - INTERVAL '30 days'
  AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id);
```

## 5. Audit complet (état actuel)

```sql
-- Vue rapide état actuel — utilisable régulièrement post-deploy
WITH stats AS (
  SELECT
    kind,
    COUNT(*) AS n,
    COUNT(*) FILTER (WHERE status = 'open') AS open,
    COUNT(*) FILTER (WHERE status = 'archived') AS archived,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM chat_message m WHERE m.session_id = chat_session.id AND m.role = 'user'
    )) AS has_user_msg,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM chat_lead l WHERE l.session_id = chat_session.id
    )) AS has_lead
  FROM chat_session
  GROUP BY 1
)
SELECT * FROM stats
UNION ALL
SELECT 'TOTAL', SUM(n), SUM(open), SUM(archived), SUM(has_user_msg), SUM(has_lead)
FROM stats;
```

## 6. KPIs business (vue admin)

```sql
-- 6.1 Conversion rate "vraie" (chat purs)
WITH chat_sessions_window AS (
  SELECT id FROM chat_session
  WHERE kind = 'chat'
    AND opened_at >= NOW() - INTERVAL '30 days'
    AND EXISTS (SELECT 1 FROM chat_message m WHERE m.session_id = chat_session.id AND m.role = 'user')
),
chat_conversions_window AS (
  SELECT DISTINCT s.id
  FROM chat_session s
  LEFT JOIN chat_lead l ON l.session_id = s.id
  WHERE s.kind = 'chat'
    AND s.opened_at >= NOW() - INTERVAL '30 days'
    AND (s.converted_at IS NOT NULL OR (l.outcome = 'converted' AND l.source IN ('chat_widget', 'inline')))
)
SELECT
  (SELECT COUNT(*) FROM chat_sessions_window) AS sessions,
  (SELECT COUNT(*) FROM chat_conversions_window) AS conversions,
  ROUND(
    (SELECT COUNT(*)::numeric FROM chat_conversions_window) /
    NULLIF((SELECT COUNT(*) FROM chat_sessions_window), 0) * 100,
    2
  ) AS conversion_rate_pct;

-- 6.2 Leads SLA Care (pending > 4h)
SELECT COUNT(*) AS hot_pending_overdue
FROM chat_lead
WHERE outcome = 'pending'
  AND trigger_reason IN ('purchase-intent', 'explicit-request', 'inline-contact')
  AND created_at < NOW() - INTERVAL '4 hours'
  AND source IN ('chat_widget', 'inline');
```

## 7. Monitoring quotidien (à automatiser)

Ajouter dans la cron de monitoring (`/api/cron/chat/health-check` si existe) :

```ts
// Pseudo-code
const stats = await db.execute<{ kind: string; n: number }>(sql`
  SELECT kind, COUNT(*) AS n
  FROM chat_session
  WHERE opened_at >= NOW() - INTERVAL '24 hours'
  GROUP BY kind
`);

// Émettre les stats vers Plausible ou Sentry
for (const row of stats.rows) {
  await plausibleEvent('chat_session_count_24h', {
    kind: row.kind,
    count: row.n,
  });
}

// Alerter si pollution suspecte
const wizardCount = stats.rows.find((r) => r.kind === 'wizard_pivot')?.n ?? 0;
const chatCount = stats.rows.find((r) => r.kind === 'chat')?.n ?? 0;
if (wizardCount > 10 * chatCount) {
  await sentryAlert('chat.pollution.wizard_high', { wizardCount, chatCount });
}
```

## 8. Audit cohérence cross-table (à exécuter mensuel)

```sql
-- Détecte les incohérences kind ↔ source qui sont restées
SELECT
  s.kind AS session_kind,
  l.source AS lead_source,
  COUNT(*) AS n
FROM chat_session s
JOIN chat_lead l ON l.session_id = s.id
GROUP BY 1, 2
HAVING (
  (s.kind = 'chat' AND l.source IN ('wizard_kit', 'wizard_commander'))
  OR (s.kind = 'wizard_pivot' AND l.source IN ('chat_widget', 'inline'))
)
ORDER BY n DESC;

-- Attendu : 0 rows.
-- Si > 0 : un INSERT a contourné le repo (bug à investiguer).
```

## 9. Audit avec snapshot file

Pour archiver dans `docs/.../snapshots/` :

```bash
# Exporter état JSON
psql $DATABASE_URL -c "
  SELECT json_build_object(
    'date', NOW()::text,
    'total_sessions', (SELECT COUNT(*) FROM chat_session),
    'by_kind', (
      SELECT json_object_agg(kind, n)
      FROM (SELECT kind, COUNT(*) AS n FROM chat_session GROUP BY 1) t
    ),
    'total_leads', (SELECT COUNT(*) FROM chat_lead),
    'by_source', (
      SELECT json_object_agg(source, n)
      FROM (SELECT source, COUNT(*) AS n FROM chat_lead GROUP BY 1) t
    )
  )
" > docs/chat-conversations-leads-fix-2026-05/04-data-strategy/snapshots/$(date +%Y-%m-%d).json
```
