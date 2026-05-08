# 11 — Runbook

> *Opérations courantes : refresh manuel, troubleshoot, ajout d'une vue*

---

## 1. Pré-requis

- Accès admin avec rôle `analytics-viewer` minimum
- Accès Vercel pour les logs cron
- Accès Neon pour les diagnostics SQL

## 2. Déclencher un refresh manuel

### 2.1 Depuis l'UI

1. Ouvrir `/admin/analytics/insights`.
2. Bouton **Refresh maintenant** dans `<InsightsRefreshIndicator>`.
3. Patienter 10-30 s. L'indicateur passe à "Calcul en cours…".
4. Vérifier "Dernière mise à jour : à l'instant".

### 2.2 Via API (script ops)

```sh
curl -X POST https://femiglow.ma/api/admin/analytics/insights/refresh \
  -H "Cookie: $ADMIN_SESSION_COOKIE"
```

### 2.3 Via cron CLI (test)

```sh
curl -X POST https://femiglow.ma/api/admin/analytics/insights/refresh \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 3. Désactiver le cron temporairement

### 3.1 Via UI admin

1. `/admin/analytics/insights` → bouton **Désactiver auto**.
2. L'indicateur passe à "Refresh désactivé · Manuel uniquement".
3. Le cron Vercel continue mais retourne `{ skipped: true }`.

### 3.2 Via API

```sh
curl -X PATCH https://femiglow.ma/api/admin/analytics/insights/settings \
  -H "Cookie: $ADMIN_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

## 4. Diagnostiquer un refresh failed

### 4.1 Identifier le run

```sql
SELECT id, status, started_at, finished_at, error_code, error_message
FROM insights_refresh_run
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 5;
```

### 4.2 Regarder les logs Vercel

`Vercel Dashboard → Project → Logs`. Filter par
`/api/admin/analytics/insights/refresh` + niveau `error`.

### 4.3 Tester localement

```sh
pnpm --filter @femiglow/web dev
# Dans un autre shell :
curl -X POST http://localhost:3000/api/admin/analytics/insights/refresh \
  -H "Cookie: $ADMIN_SESSION_COOKIE"
```

### 4.4 Causes fréquentes

| Symptôme                                   | Cause probable                              | Fix                                                |
| ------------------------------------------ | ------------------------------------------- | -------------------------------------------------- |
| `error_code: lock_held`                     | Run précédent encore en cours                | Attendre 5 min ou écraser via SQL                  |
| Timeout > 60 s                              | Volume de données trop gros                  | Optimiser indexes, réduire backfill                 |
| `error_code: db_connection`                | Neon down / quota                              | Vérifier Neon dashboard                             |
| `error_code: invalid_data`                  | Schéma `tracking_events_log` modifié          | Mettre à jour `refreshXxxDaily()`                  |
| Pas de mise à jour `refreshed_at`            | Aucun event nouveau dans la fenêtre           | Comportement normal                                  |

## 5. Forcer un backfill complet

```sql
-- Vide les tables (attention)
TRUNCATE insights_event_daily;
TRUNCATE insights_page_daily;
TRUNCATE insights_component_daily;
TRUNCATE insights_section_daily;
TRUNCATE insights_funnel_daily;

-- Puis lancer un refresh manuel
-- (le code détecte tables vides et backfill 90j)
```

Coût : ~ 60 secondes une fois.

## 6. Ajouter une nouvelle vue agrégée

Procédure pour ajouter par exemple `insights_traffic_source_daily`.

### 6.1 Migration

```sql
-- drizzle/0033_insights_traffic_source.sql
CREATE TABLE insights_traffic_source_daily (
  id text PRIMARY KEY,
  date date NOT NULL,
  traffic_source text NOT NULL,
  count integer NOT NULL,
  CONSTRAINT itf_unique UNIQUE (date, traffic_source)
);
CREATE INDEX itf_date_idx ON insights_traffic_source_daily (date DESC);
```

### 6.2 Service

```ts
// lib/analytics/insights/traffic-sources.ts
export async function refreshTrafficSourceDaily(): Promise<number> { /* … */ }
export const trafficSourcesService = { /* … */ };
```

### 6.3 Route API

```ts
// app/api/admin/analytics/insights/traffic-sources/route.ts
export async function GET(request: Request): Promise<Response> { /* … */ }
```

### 6.4 Pipeline refresh

Ajouter au `refresh.run()` :

```ts
['traffic_source', refreshTrafficSourceDaily],
```

### 6.5 Frontend (optionnel)

```tsx
// composant + hook + tests
```

### 6.6 Tests

Créer `traffic-sources.test.ts` (10 cas) + integration (5 cas).

**Total** : ~ 1 jour.

## 7. Exporter des données pour analyse externe

```sh
# CSV via UI
# /admin/analytics/insights → onglet → bouton Exporter CSV

# CSV via API
curl "https://femiglow.ma/api/admin/analytics/insights/export?view=pages&window=30d" \
  -H "Cookie: $ADMIN_SESSION_COOKIE" \
  -o pages-30d.csv

# SQL direct (admin avancé)
psql "$DB_URL" -c "
  COPY (
    SELECT * FROM insights_page_daily
    WHERE date >= NOW() - INTERVAL '30 days'
  ) TO STDOUT WITH CSV HEADER
" > pages-30d.csv
```

## 8. Purge

Cron mensuel `POST /api/cron/insights-purge` (Bearer secret).

Manuel :

```sh
curl -X POST https://femiglow.ma/api/cron/insights-purge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Ou SQL direct :

```sql
DELETE FROM insights_event_daily WHERE date < NOW() - INTERVAL '24 months';
DELETE FROM insights_refresh_run WHERE started_at < NOW() - INTERVAL '90 days';
```

## 9. Monitoring

### 9.1 Métriques à surveiller

| Métrique                                          | Cible        | Alerte                  |
| ------------------------------------------------- | ------------ | ----------------------- |
| Taux de réussite refresh                           | ≥ 99 %       | < 95 % sur 24h          |
| Durée refresh p95                                  | < 30 s       | > 60 s                  |
| Latence GET overview p95                           | < 250 ms     | > 1 s                   |
| Taille `insights_event_daily`                      | < 5 M lignes | > 10 M                  |
| Cron Vercel exécutions vs réussite                 | 96 / jour    | < 90 / jour             |

### 9.2 Alerting

Slack webhook côté Vercel sur :
- `analytics.insights.refresh.failed`
- `analytics.insights.export.too_large`

## 10. Incident — refresh saturé

### 10.1 Détection

Indicateur "Calcul en cours…" depuis > 5 min.

### 10.2 Actions

1. Vérifier `insights_refresh_run` : un run actif ?
2. Si oui et > 5 min : kill le lock manuellement
   ```sql
   UPDATE insights_refresh_run
     SET status = 'failed',
         error_code = 'manual_kill',
         finished_at = NOW()
     WHERE status = 'running';
   ```
3. Désactiver temporairement le cron via UI.
4. Diagnostiquer la cause (logs, SQL slow query).
5. Réactiver après fix.

## 11. Incident — page admin inaccessible

### 11.1 Symptômes

`/admin/analytics/insights` → 500 ou hangs.

### 11.2 Actions

1. Vérifier `insights_*` tables existent (Neon dashboard).
2. Vérifier qu'au moins un run réussi existe :
   ```sql
   SELECT * FROM insights_refresh_run
     WHERE status = 'success'
     ORDER BY finished_at DESC
     LIMIT 1;
   ```
3. Si aucun → backfill manuel (cf. §5).
4. Si tables existent : check logs Vercel pour la route concernée.

## 12. Liste des feature flags

| Flag                                  | Effet                                                  |
| ------------------------------------- | ------------------------------------------------------ |
| `insights.refresh_enabled`            | Active / désactive le cron de refresh                  |
| `insights.refresh_interval_minutes`   | 5 / 10 / 15 / 30 / 60                                   |
| `insights.export_enabled`             | (V2) active / désactive les exports                     |
| `insights.first_run_completed`        | flag interne pour `firstRun` UI                          |

## 13. Contacts

| Rôle                  | Contact                       |
| --------------------- | ----------------------------- |
| DRI                   | elazhar.jebbari@gmail.com    |
| Acquisition           | (à désigner)                  |
| Astreinte             | (à organiser)                 |

## 14. Lecture suivante

- [00 — Cahier des charges](00-cahier-des-charges.md) — exigences.
- [10 — Plan d'action](10-plan-action.md) — séquence d'exécution.
- [12 — Sécurité & RGPD](12-securite-rgpd.md) — droit à l'oubli.
