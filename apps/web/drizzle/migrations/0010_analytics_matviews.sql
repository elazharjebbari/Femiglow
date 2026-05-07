-- Migration 0010 : analytics — vues matérialisées
-- cf. docs/analytics/02-data-model.md §3 et docs/analytics/05-onglets-specs.md
-- Quatre vues, rafraîchies par cron (cf. /api/cron/analytics-refresh).
-- Toutes filtrent consent_snapshot->>'analytics_storage' = 'granted' pour
-- respecter le RGPD : les events `denied` restent en raw mais n'apparaissent
-- jamais dans les KPI publics.

-- ───────────────────────────────────────────────────────────────────────
-- mv_overview_hourly : agrégats par heure × device × source
-- Source de vérité pour l'onglet Vue d'ensemble (KPI + courbes).
-- ───────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_overview_hourly" AS
SELECT
  date_trunc('hour', received_at) AS bucket,
  device,
  COALESCE(traffic_source, 'direct') AS traffic_source,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT anonymous_id) AS unique_visitors,
  COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
  COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'view_item') AS item_views,
  COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'add_to_cart') AS add_to_carts,
  COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'begin_checkout') AS begin_checkouts,
  COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'purchase') AS purchases,
  COALESCE(SUM((payload->>'value')::numeric) FILTER (WHERE event_name = 'purchase'), 0) AS revenue,
  COUNT(DISTINCT session_id) FILTER (
    WHERE session_id IN (
      SELECT session_id FROM "tracking_events_log" e2
      WHERE e2.session_id = "tracking_events_log".session_id
      GROUP BY session_id
      HAVING COUNT(DISTINCT page_route) <= 1
    )
  ) AS bounce_sessions
FROM "tracking_events_log"
WHERE consent_snapshot->>'analytics_storage' = 'granted'
GROUP BY 1, 2, 3
WITH NO DATA;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mv_overview_hourly_pk"
  ON "mv_overview_hourly" ("bucket", "device", "traffic_source");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mv_overview_hourly_bucket_idx"
  ON "mv_overview_hourly" ("bucket" DESC);
--> statement-breakpoint

-- ───────────────────────────────────────────────────────────────────────
-- mv_funnel_daily : sessions par funnel_stage × jour × device × source
-- Source de vérité pour l'onglet Funnel.
-- ───────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_funnel_daily" AS
SELECT
  date_trunc('day', e.received_at) AS bucket_day,
  COALESCE(d.funnel_stage::text, 'none') AS funnel_stage,
  e.device,
  COALESCE(e.traffic_source, 'direct') AS traffic_source,
  COUNT(DISTINCT e.session_id) AS sessions,
  COUNT(*) AS events
FROM "tracking_events_log" e
LEFT JOIN "tracking_event_definitions" d ON d.name = e.event_name
WHERE e.consent_snapshot->>'analytics_storage' = 'granted'
GROUP BY 1, 2, 3, 4
WITH NO DATA;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mv_funnel_daily_pk"
  ON "mv_funnel_daily" ("bucket_day", "funnel_stage", "device", "traffic_source");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "mv_funnel_daily_bucket_idx"
  ON "mv_funnel_daily" ("bucket_day" DESC);
--> statement-breakpoint

-- ───────────────────────────────────────────────────────────────────────
-- mv_cta_performance : impressions / clicks / purchases (attribution 7j)
-- Source de vérité pour l'onglet CTA.
-- Attribution : on associe à un click un purchase de la même session OU
-- d'une session ultérieure (≤ 7 jours) du même anonymous_id.
-- ───────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_cta_performance" AS
WITH clicks AS (
  SELECT
    date_trunc('day', received_at) AS bucket_day,
    component_id,
    session_id,
    anonymous_id,
    received_at AS clicked_at
  FROM "tracking_events_log"
  WHERE event_name IN ('click','select_content','cta_click')
    AND component_id IS NOT NULL
    AND consent_snapshot->>'analytics_storage' = 'granted'
),
impressions AS (
  SELECT
    date_trunc('day', received_at) AS bucket_day,
    component_id,
    COUNT(*) AS impressions
  FROM "tracking_events_log"
  WHERE event_name IN ('view_item','cta_impression','select_content')
    AND component_id IS NOT NULL
    AND consent_snapshot->>'analytics_storage' = 'granted'
  GROUP BY 1, 2
),
attributed_purchases AS (
  SELECT
    c.bucket_day,
    c.component_id,
    p.session_id AS purchase_session_id,
    p.received_at AS purchased_at,
    COALESCE((p.payload->>'value')::numeric, 0) AS revenue
  FROM clicks c
  JOIN "tracking_events_log" p
    ON p.event_name = 'purchase'
   AND p.anonymous_id = c.anonymous_id
   AND p.received_at >= c.clicked_at
   AND p.received_at <= c.clicked_at + interval '7 days'
   AND p.consent_snapshot->>'analytics_storage' = 'granted'
)
SELECT
  COALESCE(c.bucket_day, i.bucket_day) AS bucket_day,
  COALESCE(c.component_id, i.component_id) AS component_id,
  COALESCE(i.impressions, 0) AS impressions,
  COALESCE(COUNT(DISTINCT c.session_id), 0) AS clicks,
  COALESCE(COUNT(DISTINCT ap.purchase_session_id), 0) AS purchases_after_click,
  COALESCE(SUM(ap.revenue), 0) AS revenue_after_click
FROM clicks c
FULL OUTER JOIN impressions i USING (bucket_day, component_id)
LEFT JOIN attributed_purchases ap
  ON ap.bucket_day = c.bucket_day AND ap.component_id = c.component_id
GROUP BY COALESCE(c.bucket_day, i.bucket_day),
         COALESCE(c.component_id, i.component_id),
         i.impressions
WITH NO DATA;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mv_cta_performance_pk"
  ON "mv_cta_performance" ("bucket_day", "component_id");
--> statement-breakpoint

-- ───────────────────────────────────────────────────────────────────────
-- mv_checkout_steps : volumes par step + abandons par session
-- Source de vérité pour l'onglet Checkout.
-- ───────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_checkout_steps" AS
WITH session_funnel AS (
  SELECT
    session_id,
    date_trunc('day', MIN(received_at)) AS bucket_day,
    BOOL_OR(event_name = 'view_cart') AS view_cart,
    BOOL_OR(event_name = 'begin_checkout') AS begin_checkout,
    BOOL_OR(event_name = 'add_shipping_info') AS add_shipping,
    BOOL_OR(event_name = 'add_payment_info') AS add_payment,
    BOOL_OR(event_name = 'purchase') AS purchase
  FROM "tracking_events_log"
  WHERE consent_snapshot->>'analytics_storage' = 'granted'
  GROUP BY session_id
)
SELECT
  bucket_day,
  COUNT(*) FILTER (WHERE view_cart) AS view_cart_sessions,
  COUNT(*) FILTER (WHERE begin_checkout) AS begin_checkout_sessions,
  COUNT(*) FILTER (WHERE add_shipping) AS add_shipping_sessions,
  COUNT(*) FILTER (WHERE add_payment) AS add_payment_sessions,
  COUNT(*) FILTER (WHERE purchase) AS purchase_sessions,
  COUNT(*) FILTER (WHERE begin_checkout AND NOT purchase) AS abandoned_sessions
FROM session_funnel
GROUP BY 1
WITH NO DATA;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "mv_checkout_steps_pk"
  ON "mv_checkout_steps" ("bucket_day");
