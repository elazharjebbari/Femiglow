# 02 — Couche data

> *Vues matérialisées, indexes, partitionnement, retention*

---

## 1. Vue d'ensemble

6 tables au total, toutes au format Drizzle dans
`apps/web/src/lib/db/schema.ts`. Conventions FemiGlow :

- préfixe id `iev_`, `ipa_`, `ico_`, `ise_`, `ifu_`, `irf_`
- timestamps `received_at` (source) et `refreshed_at` (write)
- toutes les agrégations granulées **par jour calendaire**
  (timezone Casablanca, défini par `date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')`)
- contraintes UNIQUE sur les dimensions + date pour permettre
  `INSERT … ON CONFLICT … DO UPDATE`

## 2. `insights_event_daily`

```sql
CREATE TABLE insights_event_daily (
  id              text PRIMARY KEY,                  -- iev_xxxxxxxx
  date            date NOT NULL,
  event_name      text NOT NULL,
  event_category  text NOT NULL,
  env             text NOT NULL,                     -- production / stage / preview / dev
  device          text NOT NULL,                     -- mobile / desktop / tablet / unknown
  locale          text NOT NULL,                     -- fr-MA / ar-MA / fr-FR / unknown
  count           integer NOT NULL,
  unique_sessions integer NOT NULL,
  conversion_count integer NOT NULL DEFAULT 0,        -- non zéro pour les events conversion
  refreshed_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT iev_unique UNIQUE (date, event_name, env, device, locale)
);

CREATE INDEX iev_date_idx                   ON insights_event_daily (date DESC);
CREATE INDEX iev_event_idx                  ON insights_event_daily (event_name, date DESC);
CREATE INDEX iev_category_idx               ON insights_event_daily (event_category, date DESC);
CREATE INDEX iev_env_idx                    ON insights_event_daily (env, date DESC);
```

## 3. `insights_page_daily`

```sql
CREATE TABLE insights_page_daily (
  id              text PRIMARY KEY,                  -- ipa_xxxxxxxx
  date            date NOT NULL,
  page_route      text NOT NULL,
  page_views      integer NOT NULL DEFAULT 0,         -- count(*) où event = 'page_view'
  unique_sessions integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,         -- distinct anonymous_id
  events_total    integer NOT NULL DEFAULT 0,         -- tous events sur la page
  scroll_75_count integer NOT NULL DEFAULT 0,         -- engagement profond
  conversions     integer NOT NULL DEFAULT 0,
  bounce_count    integer NOT NULL DEFAULT 0,         -- sessions à 1 page_view seul
  avg_time_seconds integer NOT NULL DEFAULT 0,        -- dérivé via session timestamps
  refreshed_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ipa_unique UNIQUE (date, page_route)
);

CREATE INDEX ipa_date_idx       ON insights_page_daily (date DESC);
CREATE INDEX ipa_route_idx      ON insights_page_daily (page_route, date DESC);
CREATE INDEX ipa_pv_idx         ON insights_page_daily (page_views DESC, date DESC);
```

## 4. `insights_component_daily`

```sql
CREATE TABLE insights_component_daily (
  id              text PRIMARY KEY,                  -- ico_xxxxxxxx
  date            date NOT NULL,
  component_id    text NOT NULL,
  component_name  text,                              -- jointure tracking_components
  page_route      text,                              -- route de l'event (peut être null)
  event_name      text NOT NULL,
  count           integer NOT NULL DEFAULT 0,
  unique_sessions integer NOT NULL DEFAULT 0,
  conversion_count integer NOT NULL DEFAULT 0,
  refreshed_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ico_unique UNIQUE (date, component_id, event_name, page_route)
);

CREATE INDEX ico_date_idx       ON insights_component_daily (date DESC);
CREATE INDEX ico_component_idx  ON insights_component_daily (component_id, date DESC);
CREATE INDEX ico_event_idx      ON insights_component_daily (event_name, date DESC);
CREATE INDEX ico_count_idx      ON insights_component_daily (count DESC, date DESC);
```

## 5. `insights_section_daily`

```sql
CREATE TABLE insights_section_daily (
  id                 text PRIMARY KEY,                  -- ise_xxxxxxxx
  date               date NOT NULL,
  page_route         text NOT NULL,
  section_id         text NOT NULL,
  views              integer NOT NULL DEFAULT 0,         -- fg_section_view count
  avg_dwell_seconds  integer NOT NULL DEFAULT 0,         -- durée moyenne (dérivée)
  unique_sessions    integer NOT NULL DEFAULT 0,
  refreshed_at       timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ise_unique UNIQUE (date, page_route, section_id)
);

CREATE INDEX ise_date_idx       ON insights_section_daily (date DESC);
CREATE INDEX ise_route_idx      ON insights_section_daily (page_route, date DESC);
CREATE INDEX ise_dwell_idx      ON insights_section_daily (avg_dwell_seconds DESC, date DESC);
```

> **Calcul de `avg_dwell_seconds`** : on dérive depuis les paires
> `fg_section_view` consécutives sur une même session ; durée
> approximative par diff de timestamps. Si une seule view par
> session : 0.

## 6. `insights_funnel_daily`

Funnel ecommerce — une ligne par jour.

```sql
CREATE TABLE insights_funnel_daily (
  id                 text PRIMARY KEY,                  -- ifu_xxxxxxxx
  date               date NOT NULL UNIQUE,
  view_item          integer NOT NULL DEFAULT 0,
  add_to_cart        integer NOT NULL DEFAULT 0,
  begin_checkout     integer NOT NULL DEFAULT 0,
  add_payment_info   integer NOT NULL DEFAULT 0,
  purchase           integer NOT NULL DEFAULT 0,
  generate_lead      integer NOT NULL DEFAULT 0,
  unique_purchasers  integer NOT NULL DEFAULT 0,
  revenue_total      numeric(12, 2) NOT NULL DEFAULT 0,
  refreshed_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX ifu_date_idx       ON insights_funnel_daily (date DESC);
```

## 7. `insights_refresh_run`

Orchestration et historique.

```sql
CREATE TABLE insights_refresh_run (
  id              text PRIMARY KEY,                  -- irf_xxxxxxxx
  trigger         text NOT NULL,                     -- 'cron' | 'manual'
  status          text NOT NULL,                     -- 'running' | 'success' | 'failed'
  started_at      timestamptz NOT NULL DEFAULT NOW(),
  finished_at     timestamptz,
  durations_ms    jsonb,                             -- { event: 4200, page: 1100, ... }
  counts          jsonb,                             -- { event: 1245, page: 240, ... }
  error_code      text,
  error_message   text,
  triggered_by    text                                -- adminId ou 'cron'
);

CREATE INDEX irf_started_idx     ON insights_refresh_run (started_at DESC);
CREATE INDEX irf_status_idx      ON insights_refresh_run (status, started_at DESC);
```

## 8. Migrations Drizzle

```
drizzle/
  0030_insights_init.sql        # 6 tables + indexes
  0031_insights_seed_pages.sql  # seed de pages connues (optionnel)
  0032_insights_view_dashboard.sql # vue lecture-seule pour le frontend
```

`0030_insights_init.sql` (extrait) :

```sql
CREATE TABLE insights_event_daily (...);
CREATE TABLE insights_page_daily (...);
CREATE TABLE insights_component_daily (...);
CREATE TABLE insights_section_daily (...);
CREATE TABLE insights_funnel_daily (...);
CREATE TABLE insights_refresh_run (...);
```

## 9. Volumétrie cible

| Table                       | Lignes 30 j (estim.) | Lignes 1 an     |
| --------------------------- | -------------------- | --------------- |
| `insights_event_daily`      | ~ 50 000             | ~ 600 000        |
| `insights_page_daily`       | ~ 1 800              | ~ 22 000         |
| `insights_component_daily`  | ~ 100 000            | ~ 1.2 M          |
| `insights_section_daily`    | ~ 30 000             | ~ 360 000        |
| `insights_funnel_daily`     | ~ 30                 | ~ 365            |
| `insights_refresh_run`      | ~ 3 000 (cron 15 min) | ~ 35 000        |

Volumes confortables sur Neon Pro. Si `insights_component_daily`
explose au-delà de 5 M, partitionner par mois (Drizzle 0.45+ supporte
les `pgTable` partitionnés).

## 10. Retention

| Table                       | Conservation | Action après expiration                    |
| --------------------------- | ------------ | ------------------------------------------ |
| `insights_event_daily`      | 24 mois      | Purge ligne par ligne (cron mensuel)        |
| `insights_page_daily`       | 24 mois      | idem                                        |
| `insights_component_daily`  | 12 mois      | idem (volume plus élevé)                    |
| `insights_section_daily`    | 12 mois      | idem                                        |
| `insights_funnel_daily`     | 36 mois      | conservation longue (KPIs annuels)          |
| `insights_refresh_run`      | 90 jours     | purge auto (audit suffisant en short-term)  |

> Cron `POST /api/cron/insights-purge` (existant pattern, à
> dupliquer depuis `tracking-purge`).

## 11. RGPD

- Aucun `anonymous_id` ni `session_id` brut dans les tables
  `insights_*` (uniquement des comptes ou des distincts).
- `unique_sessions` est un `count(distinct session_id)` : pas
  réversible vers un visiteur.
- Pas de `user_id` exposé.
- Droit à l'oubli : ne s'applique pas aux pré-agrégations
  (anonymisées par construction).

## 12. Performance attendue

| Requête                                                           | Cible p95   |
| ---------------------------------------------------------------- | ----------- |
| `SELECT … FROM insights_event_daily WHERE date BETWEEN … LIMIT 60` | < 30 ms     |
| `SELECT … FROM insights_page_daily ORDER BY page_views DESC LIMIT 30` | < 40 ms |
| `SELECT … FROM insights_component_daily WHERE component_id = ?`    | < 20 ms     |
| `SELECT … FROM insights_funnel_daily WHERE date BETWEEN …`         | < 15 ms     |
| Refresh complet 30 j × 100k events                                  | < 30 s      |

## 13. Lecture suivante

- [03 — Backend](03-backend.md) pour les services qui consomment ces tables.
- [07 — Refresh & orchestration](07-refresh-orchestration.md) pour la
  logique d'incrémental.
- [annexes/sql-queries.md](annexes/sql-queries.md) pour les
  requêtes de pré-agrégation détaillées.
