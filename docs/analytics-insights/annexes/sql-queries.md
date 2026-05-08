# Annexe — SQL queries

> *Requêtes de pré-agrégation détaillées*

---

## 1. `refreshEventDaily`

```sql
INSERT INTO insights_event_daily
  (id, date, event_name, event_category, env, device, locale,
   count, unique_sessions, conversion_count, refreshed_at)
SELECT
  'iev_' || substr(md5(random()::text), 1, 14),
  date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
  event_name,
  event_category,
  coalesce(env, 'unknown') AS env,
  device,
  coalesce(locale, 'unknown') AS locale,
  count(*)::int AS count,
  count(distinct session_id)::int AS unique_sessions,
  count(*) filter (where is_conversion)::int AS conversion_count,
  NOW() AS refreshed_at
FROM tracking_events_log
WHERE received_at >= $1
GROUP BY 2, 3, 4, 5, 6, 7
ON CONFLICT (date, event_name, env, device, locale) DO UPDATE
  SET count = EXCLUDED.count,
      unique_sessions = EXCLUDED.unique_sessions,
      conversion_count = EXCLUDED.conversion_count,
      refreshed_at = NOW();
```

## 2. `refreshPageDaily`

```sql
INSERT INTO insights_page_daily
  (id, date, page_route, page_views, unique_sessions, unique_visitors,
   events_total, scroll_75_count, conversions, bounce_count,
   avg_time_seconds, refreshed_at)
WITH page_events AS (
  SELECT
    date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
    page_route,
    event_name,
    session_id,
    anonymous_id,
    is_conversion,
    coalesce((payload->>'scroll_depth')::int, 0) AS scroll_depth
  FROM tracking_events_log
  WHERE received_at >= $1
    AND page_route IS NOT NULL
)
SELECT
  'ipa_' || substr(md5(random()::text), 1, 14),
  date,
  page_route,
  count(*) filter (where event_name = 'page_view')::int,
  count(distinct session_id)::int,
  count(distinct anonymous_id)::int,
  count(*)::int,
  count(*) filter (where event_name = 'scroll_depth' and scroll_depth >= 75)::int,
  count(*) filter (where is_conversion)::int,
  0, -- bounce_count calculé via sous-requête (cf. §6)
  0, -- avg_time_seconds calculé via sous-requête (cf. §7)
  NOW()
FROM page_events
GROUP BY 2, 3
ON CONFLICT (date, page_route) DO UPDATE
  SET page_views = EXCLUDED.page_views,
      unique_sessions = EXCLUDED.unique_sessions,
      unique_visitors = EXCLUDED.unique_visitors,
      events_total = EXCLUDED.events_total,
      scroll_75_count = EXCLUDED.scroll_75_count,
      conversions = EXCLUDED.conversions,
      refreshed_at = NOW();
```

## 3. `refreshComponentDaily`

```sql
INSERT INTO insights_component_daily
  (id, date, component_id, component_name, page_route, event_name,
   count, unique_sessions, conversion_count, refreshed_at)
SELECT
  'ico_' || substr(md5(random()::text), 1, 14),
  date_trunc('day', tel.received_at AT TIME ZONE 'Africa/Casablanca')::date,
  tel.component_id,
  tc.name,
  tel.page_route,
  tel.event_name,
  count(*)::int,
  count(distinct tel.session_id)::int,
  count(*) filter (where tel.is_conversion)::int,
  NOW()
FROM tracking_events_log tel
LEFT JOIN tracking_components tc ON tc.id = tel.component_id
WHERE tel.received_at >= $1
  AND tel.component_id IS NOT NULL
GROUP BY 2, 3, 4, 5, 6
ON CONFLICT (date, component_id, event_name, page_route) DO UPDATE
  SET count = EXCLUDED.count,
      unique_sessions = EXCLUDED.unique_sessions,
      conversion_count = EXCLUDED.conversion_count,
      component_name = EXCLUDED.component_name,
      refreshed_at = NOW();
```

## 4. `refreshSectionDaily` (avec dwell time)

```sql
WITH section_views AS (
  SELECT
    received_at,
    page_route,
    payload->>'section_id' AS section_id,
    session_id,
    LEAD(received_at) OVER (PARTITION BY session_id ORDER BY received_at) AS next_event_at
  FROM tracking_events_log
  WHERE received_at >= $1
    AND event_name = 'fg_section_view'
    AND payload->>'section_id' IS NOT NULL
),
section_dwell AS (
  SELECT
    date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
    page_route,
    section_id,
    session_id,
    LEAST(
      coalesce(EXTRACT(EPOCH FROM (next_event_at - received_at)), 0),
      300 -- cap à 5 min pour éviter les durées aberrantes
    ) AS dwell_seconds
  FROM section_views
)
INSERT INTO insights_section_daily
  (id, date, page_route, section_id, views, avg_dwell_seconds,
   unique_sessions, refreshed_at)
SELECT
  'ise_' || substr(md5(random()::text), 1, 14),
  date,
  page_route,
  section_id,
  count(*)::int,
  round(avg(dwell_seconds))::int,
  count(distinct session_id)::int,
  NOW()
FROM section_dwell
GROUP BY 2, 3, 4
ON CONFLICT (date, page_route, section_id) DO UPDATE
  SET views = EXCLUDED.views,
      avg_dwell_seconds = EXCLUDED.avg_dwell_seconds,
      unique_sessions = EXCLUDED.unique_sessions,
      refreshed_at = NOW();
```

## 5. `refreshFunnelDaily`

```sql
INSERT INTO insights_funnel_daily
  (id, date, view_item, add_to_cart, begin_checkout,
   add_payment_info, purchase, generate_lead,
   unique_purchasers, revenue_total, refreshed_at)
SELECT
  'ifu_' || substr(md5(random()::text), 1, 14),
  date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
  count(*) filter (where event_name = 'view_item')::int,
  count(*) filter (where event_name = 'add_to_cart')::int,
  count(*) filter (where event_name = 'begin_checkout')::int,
  count(*) filter (where event_name = 'add_payment_info')::int,
  count(*) filter (where event_name = 'purchase')::int,
  count(*) filter (where event_name = 'generate_lead')::int,
  count(distinct session_id) filter (where event_name = 'purchase')::int,
  coalesce(sum((payload->>'value')::numeric) filter (where event_name = 'purchase'), 0),
  NOW()
FROM tracking_events_log
WHERE received_at >= $1
GROUP BY 2
ON CONFLICT (date) DO UPDATE
  SET view_item = EXCLUDED.view_item,
      add_to_cart = EXCLUDED.add_to_cart,
      begin_checkout = EXCLUDED.begin_checkout,
      add_payment_info = EXCLUDED.add_payment_info,
      purchase = EXCLUDED.purchase,
      generate_lead = EXCLUDED.generate_lead,
      unique_purchasers = EXCLUDED.unique_purchasers,
      revenue_total = EXCLUDED.revenue_total,
      refreshed_at = NOW();
```

## 6. Calcul `bounce_count`

Bounce = session avec un seul `page_view` total.

```sql
WITH session_pv_count AS (
  SELECT
    session_id,
    page_route,
    date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
    count(*) filter (where event_name = 'page_view') AS pv
  FROM tracking_events_log
  WHERE received_at >= $1
  GROUP BY 1, 2, 3
)
SELECT
  date,
  page_route,
  count(*) filter (where pv = 1) AS bounce_count
FROM session_pv_count
GROUP BY 1, 2;
```

Update via `WITH` + `UPDATE`.

## 7. Calcul `avg_time_seconds`

Durée moyenne sur la page = différence entre première et dernière
event d'une session sur cette page.

```sql
WITH page_session_window AS (
  SELECT
    date_trunc('day', received_at AT TIME ZONE 'Africa/Casablanca')::date AS date,
    page_route,
    session_id,
    EXTRACT(EPOCH FROM (max(received_at) - min(received_at))) AS dwell
  FROM tracking_events_log
  WHERE received_at >= $1
    AND page_route IS NOT NULL
  GROUP BY 1, 2, 3
)
SELECT date, page_route, round(avg(dwell))::int AS avg_time_seconds
FROM page_session_window
WHERE dwell BETWEEN 0 AND 1800 -- cap 30 min
GROUP BY 1, 2;
```

## 8. Lectures (services backend)

### 8.1 `overviewService.get`

```sql
SELECT
  sum(count) AS total_events,
  sum(unique_sessions) AS unique_sessions,
  sum(conversion_count) AS conversions
FROM insights_event_daily
WHERE date BETWEEN $1 AND $2
  AND ($3 = 'all' OR env = $3)
  AND ($4 = 'all' OR device = $4)
  AND ($5 = 'all' OR locale = $5);
```

### 8.2 `pagesService.top`

```sql
SELECT
  page_route,
  sum(page_views) AS pv,
  sum(unique_sessions) AS sessions,
  sum(conversions) AS conv,
  sum(scroll_75_count) AS s75
FROM insights_page_daily
WHERE date BETWEEN $1 AND $2
GROUP BY page_route
ORDER BY pv DESC
LIMIT 30;
```

### 8.3 `componentsService.top`

```sql
SELECT
  component_id,
  max(component_name) AS name,
  page_route,
  sum(count) AS total
FROM insights_component_daily
WHERE date BETWEEN $1 AND $2
GROUP BY component_id, page_route
ORDER BY total DESC
LIMIT 50;
```

### 8.4 `componentsService.dead`

```sql
SELECT tc.id, tc.name
FROM tracking_components tc
WHERE tc.archived_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM insights_component_daily icd
    WHERE icd.component_id = tc.id
      AND icd.date BETWEEN $1 AND $2
  );
```

### 8.5 `sectionsService.byDwell`

```sql
SELECT
  section_id,
  page_route,
  sum(views) AS views,
  round(sum(views * avg_dwell_seconds) / nullif(sum(views), 0))::int AS avg_dwell,
  sum(unique_sessions) AS sessions
FROM insights_section_daily
WHERE date BETWEEN $1 AND $2
GROUP BY section_id, page_route
ORDER BY avg_dwell DESC NULLS LAST
LIMIT 30;
```

### 8.6 `funnelService.daily`

```sql
SELECT
  sum(view_item) AS view_item,
  sum(add_to_cart) AS add_to_cart,
  sum(begin_checkout) AS begin_checkout,
  sum(add_payment_info) AS add_payment_info,
  sum(purchase) AS purchase,
  sum(unique_purchasers) AS unique_purchasers,
  sum(revenue_total) AS revenue_total
FROM insights_funnel_daily
WHERE date BETWEEN $1 AND $2;
```

### 8.7 Heatmap

```sql
SELECT
  EXTRACT(HOUR FROM received_at AT TIME ZONE 'Africa/Casablanca')::int AS hour,
  EXTRACT(DOW FROM received_at AT TIME ZONE 'Africa/Casablanca')::int AS day_of_week,
  count(*) AS count
FROM tracking_events_log
WHERE received_at BETWEEN $1 AND $2
GROUP BY 1, 2;
```

> Note : la heatmap lit directement `tracking_events_log` car
> elle nécessite la résolution horaire. Si performance dégradée,
> ajouter une table dédiée `insights_hour_daily`.

## 9. Purge

```sql
DELETE FROM insights_event_daily      WHERE date < NOW() - INTERVAL '24 months';
DELETE FROM insights_page_daily       WHERE date < NOW() - INTERVAL '24 months';
DELETE FROM insights_component_daily  WHERE date < NOW() - INTERVAL '12 months';
DELETE FROM insights_section_daily    WHERE date < NOW() - INTERVAL '12 months';
DELETE FROM insights_funnel_daily     WHERE date < NOW() - INTERVAL '36 months';
DELETE FROM insights_refresh_run      WHERE started_at < NOW() - INTERVAL '90 days';
```

## 10. Indexes critiques

Cf. [02 — Couche data](../02-data.md) §3-7. Repris ici en synthèse :

```sql
-- insights_event_daily
CREATE INDEX iev_date_idx        ON insights_event_daily (date DESC);
CREATE INDEX iev_event_idx       ON insights_event_daily (event_name, date DESC);
CREATE INDEX iev_category_idx    ON insights_event_daily (event_category, date DESC);

-- insights_page_daily
CREATE INDEX ipa_pv_idx          ON insights_page_daily (page_views DESC, date DESC);

-- insights_component_daily
CREATE INDEX ico_count_idx       ON insights_component_daily (count DESC, date DESC);
CREATE INDEX ico_component_idx   ON insights_component_daily (component_id, date DESC);

-- insights_section_daily
CREATE INDEX ise_dwell_idx       ON insights_section_daily (avg_dwell_seconds DESC, date DESC);

-- insights_refresh_run
CREATE INDEX irf_status_idx      ON insights_refresh_run (status, started_at DESC);
```
