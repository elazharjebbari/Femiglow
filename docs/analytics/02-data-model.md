# 02 · Modèle de données

> Schéma DB, vues matérialisées, normalisation traffic, anticipation A/B. Aucun changement breaking.

## 1. Existant — `tracking_events_log` (rappel)

Source : `apps/web/src/lib/db/schema.ts` (lignes ~596–633).

```sql
-- Schéma actuel (résumé)
CREATE TABLE tracking_events_log (
  id              uuid PRIMARY KEY,
  event_id        text UNIQUE NOT NULL,         -- nanoid client-side, dedup
  event_name      text NOT NULL,                 -- ex. 'add_to_cart'
  event_category  text NOT NULL,                 -- ex. 'ecommerce'
  page_id         uuid REFERENCES tracking_pages(id),
  component_id    uuid REFERENCES tracking_components(id),
  page_route      text NOT NULL,                 -- ex. '/kit'
  anonymous_id    text,                          -- aid_… (cookie)
  session_id      text,                          -- sid_… (sessionStorage)
  user_id         uuid,                          -- si authentifié
  payload         jsonb NOT NULL,                -- shape libre, validé par schema event
  consent_snapshot jsonb,                        -- { analytics_storage, ad_storage, … }
  is_conversion   boolean NOT NULL DEFAULT false,
  providers_dispatched text[],                   -- ['ga4', 'meta']
  providers_results    jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  schema_version  integer NOT NULL DEFAULT 1,
  device          text,                          -- 'mobile' | 'tablet' | 'desktop'
  locale          text                           -- 'fr-MA', 'en-US', …
);

CREATE INDEX idx_tel_event_id ON tracking_events_log(event_id);
CREATE INDEX idx_tel_name ON tracking_events_log(event_name);
CREATE INDEX idx_tel_received_at ON tracking_events_log(received_at);
CREATE INDEX idx_tel_anonymous_id ON tracking_events_log(anonymous_id);
CREATE INDEX idx_tel_session_id ON tracking_events_log(session_id);
CREATE INDEX idx_tel_conversion ON tracking_events_log(is_conversion);
```

**Forces** : event_id unique (dedup), categorie déjà séparée, device parsé, payload jsonb riche.
**Limites pour analytics** :
1. Pas de colonne `traffic_source` (UTM/referrer encrypté dans `payload`).
2. Pas de mapping vers funnel stage.
3. Pas de FK vers une éventuelle expérimentation A/B.

## 2. Migrations additives — phase 1

> Toutes les migrations sont **additives** (NULLABLE, sans backfill obligatoire). Aucun risque de breaking change.

### 2.1 Extension de `tracking_events_log`

```sql
-- Migration 0050_analytics_traffic.sql
ALTER TABLE tracking_events_log
  ADD COLUMN traffic_source text,           -- 'google' | 'meta' | 'tiktok' | 'direct' | 'email' | 'affiliate' | 'other'
  ADD COLUMN traffic_medium text,           -- 'cpc' | 'organic' | 'social' | 'email' | 'referral' | 'direct'
  ADD COLUMN experiment_id  text;           -- 'exp_pricing_v2' (si l'utilisateur est dans une expé)

CREATE INDEX idx_tel_traffic_source ON tracking_events_log(traffic_source);
CREATE INDEX idx_tel_experiment_id  ON tracking_events_log(experiment_id) WHERE experiment_id IS NOT NULL;
```

L'enrichissement est fait à l'**ingest** (`/api/track/route.ts`) — voir §6 ci-dessous. Pour les events historiques, ces colonnes restent NULL ; les KPI le traitent en bucket "Inconnu".

### 2.2 Extension de `tracking_event_definitions`

```sql
-- Migration 0051_analytics_funnel_stage.sql
ALTER TABLE tracking_event_definitions
  ADD COLUMN funnel_stage text;             -- 'tof' | 'mof' | 'bof' | 'conversion' | NULL

-- Préset (voir 03-events-funnel-audit.md §3 pour la justification de chaque mapping)
UPDATE tracking_event_definitions SET funnel_stage = 'tof'        WHERE name IN ('page_view', 'fg_section_view', 'scroll_depth', 'video_user_play');
UPDATE tracking_event_definitions SET funnel_stage = 'mof'        WHERE name IN ('view_item', 'fg_composition_open', 'fg_journal_read_75', 'select_item', 'fg_faq_view');
UPDATE tracking_event_definitions SET funnel_stage = 'bof'        WHERE name IN ('add_to_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info');
UPDATE tracking_event_definitions SET funnel_stage = 'conversion' WHERE name IN ('purchase', 'generate_lead');
```

L'admin peut **éditer ces mappings** depuis `/admin/tracking/events` (extension légère du CRUD existant — un dropdown supplémentaire).

## 3. Vues matérialisées

> Pourquoi : les agrégats sur 30 j ou 90 j coûtent > 1 s en live. Le **dashboard doit ouvrir en < 300 ms**. → vues matérialisées rafraîchies en cron.

> Quand : 4 vues, granularité différente selon le besoin temporel.

| Vue | Granularité | Refresh | Usage |
|---|---|---|---|
| `mv_overview_hourly` | 1 ligne par (heure × device × source) | Cron 15 min | Vue d'ensemble (a) |
| `mv_funnel_daily` | 1 ligne par (jour × stage × source × device) | Cron 1 h | Funnel (c) |
| `mv_cta_performance` | 1 ligne par (component_id × jour) | Cron 1 h | CTA (d) |
| `mv_checkout_steps` | 1 ligne par (jour × step × device) | Cron 1 h | Checkout (e) |

> Live (b) ne lit **aucune** matview — query directe avec range serré (≤ 3 h).

### 3.1 `mv_overview_hourly`

```sql
-- Migration 0052_mv_overview_hourly.sql
CREATE MATERIALIZED VIEW mv_overview_hourly AS
WITH hourly AS (
  SELECT
    date_trunc('hour', received_at)         AS bucket,
    COALESCE(device,         'unknown')     AS device,
    COALESCE(traffic_source, 'unknown')     AS source,
    session_id,
    anonymous_id,
    event_name,
    is_conversion,
    payload
  FROM tracking_events_log
  WHERE received_at >= now() - interval '120 days'
    AND (consent_snapshot->>'analytics_storage') = 'granted'
)
SELECT
  bucket,
  device,
  source,
  COUNT(DISTINCT session_id)            FILTER (WHERE event_name = 'page_view')      AS sessions,
  COUNT(DISTINCT anonymous_id)          FILTER (WHERE event_name = 'page_view')      AS visitors,
  COUNT(*)                              FILTER (WHERE event_name = 'page_view')      AS pageviews,
  COUNT(*)                              FILTER (WHERE event_name = 'add_to_cart')    AS add_to_carts,
  COUNT(*)                              FILTER (WHERE event_name = 'begin_checkout') AS checkout_starts,
  COUNT(*)                              FILTER (WHERE event_name = 'purchase')       AS purchases,
  COALESCE(SUM((payload->>'value')::numeric)
              FILTER (WHERE event_name = 'purchase'), 0)                              AS revenue,
  -- Bounce = sessions ayant 1 seul page_view ET aucun event d'engagement
  COUNT(DISTINCT session_id) FILTER (
    WHERE event_name = 'page_view'
      AND session_id IN (
        SELECT session_id FROM tracking_events_log
        WHERE received_at >= bucket AND received_at < bucket + interval '1 hour'
        GROUP BY session_id
        HAVING COUNT(*) FILTER (WHERE event_name = 'page_view') = 1
           AND COUNT(*) FILTER (WHERE event_name <> 'page_view') = 0
      )
  ) AS bounced_sessions
FROM hourly
GROUP BY bucket, device, source;

CREATE UNIQUE INDEX idx_mv_overview_hourly ON mv_overview_hourly (bucket, device, source);
```

Notes :
- Le `WITH … hourly` extrait une seule fois ; le `bounced_sessions` re-query mais sur la même heure → efficace.
- Le filtre `consent_snapshot->>'analytics_storage' = 'granted'` est strict : RGPD-compliant.
- `revenue` est en **unité majeure** native (déjà dans le payload) ; la normalisation MAD se fait au niveau de la query d'API si l'admin a configuré une devise unique.

### 3.2 `mv_funnel_daily`

```sql
-- Migration 0053_mv_funnel_daily.sql
CREATE MATERIALIZED VIEW mv_funnel_daily AS
WITH labeled AS (
  SELECT
    tel.received_at::date              AS day,
    tel.session_id,
    tel.anonymous_id,
    COALESCE(tel.device, 'unknown')    AS device,
    COALESCE(tel.traffic_source, 'unknown') AS source,
    ted.funnel_stage
  FROM tracking_events_log tel
  JOIN tracking_event_definitions ted ON ted.name = tel.event_name
  WHERE tel.received_at >= now() - interval '120 days'
    AND ted.funnel_stage IS NOT NULL
    AND (tel.consent_snapshot->>'analytics_storage') = 'granted'
)
SELECT
  day,
  device,
  source,
  funnel_stage,
  COUNT(DISTINCT session_id)   AS sessions_at_stage,
  COUNT(DISTINCT anonymous_id) AS users_at_stage
FROM labeled
GROUP BY day, device, source, funnel_stage;

CREATE UNIQUE INDEX idx_mv_funnel_daily
  ON mv_funnel_daily (day, device, source, funnel_stage);
```

L'API funnel calcule les taux d'abandon en chainant les stages : `mof.sessions / tof.sessions`, `bof / mof`, `conversion / bof`.

### 3.3 `mv_cta_performance`

```sql
-- Migration 0054_mv_cta_performance.sql
-- Hypothèse : les events 'click' avec component_id non-null représentent des clics sur CTA tracé.
-- Convention : un CTA est un component qui a au moins un event 'click' attaché.

CREATE MATERIALIZED VIEW mv_cta_performance AS
WITH cta_clicks AS (
  SELECT
    tel.received_at::date              AS day,
    tel.component_id,
    tel.session_id,
    tel.page_route,
    COALESCE(tel.device, 'unknown')    AS device,
    COALESCE(tel.traffic_source, 'unknown') AS source
  FROM tracking_events_log tel
  WHERE tel.event_name = 'click'
    AND tel.component_id IS NOT NULL
    AND tel.received_at >= now() - interval '120 days'
    AND (tel.consent_snapshot->>'analytics_storage') = 'granted'
),
purchases_after_click AS (
  SELECT DISTINCT
    cc.day,
    cc.component_id,
    cc.session_id
  FROM cta_clicks cc
  JOIN tracking_events_log p ON p.session_id = cc.session_id
  WHERE p.event_name = 'purchase'
    AND p.received_at >= cc.day
    AND p.received_at < cc.day + interval '7 days'
)
SELECT
  cc.day,
  cc.component_id,
  cc.page_route,
  cc.device,
  cc.source,
  COUNT(*)                                                      AS clicks,
  COUNT(DISTINCT cc.session_id)                                 AS unique_clickers,
  COUNT(DISTINCT pac.session_id)                                AS converted_clickers
FROM cta_clicks cc
LEFT JOIN purchases_after_click pac
  ON pac.day = cc.day AND pac.component_id = cc.component_id AND pac.session_id = cc.session_id
GROUP BY cc.day, cc.component_id, cc.page_route, cc.device, cc.source;

CREATE UNIQUE INDEX idx_mv_cta_perf
  ON mv_cta_performance (day, component_id, page_route, device, source);
```

> Note : la fenêtre d'attribution est de **7 jours** (last-click). C'est un paramètre que l'admin pourra ajuster en V1.5.

### 3.4 `mv_checkout_steps`

```sql
-- Migration 0055_mv_checkout_steps.sql
CREATE MATERIALIZED VIEW mv_checkout_steps AS
WITH steps AS (
  SELECT
    received_at::date                  AS day,
    COALESCE(device, 'unknown')        AS device,
    COALESCE(traffic_source, 'unknown') AS source,
    session_id,
    event_name,
    received_at
  FROM tracking_events_log
  WHERE event_name IN ('view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase')
    AND received_at >= now() - interval '120 days'
    AND (consent_snapshot->>'analytics_storage') = 'granted'
)
SELECT
  day,
  device,
  source,
  event_name AS step,
  COUNT(DISTINCT session_id) AS sessions_at_step,
  COUNT(*)                   AS event_count
FROM steps
GROUP BY day, device, source, step;

CREATE UNIQUE INDEX idx_mv_checkout
  ON mv_checkout_steps (day, device, source, step);
```

### 3.5 Refresh stratégique

```sql
-- Cron exécuté toutes les 15 min depuis vercel.json
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_hourly;

-- Cron toutes les heures
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_funnel_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cta_performance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_checkout_steps;
```

`CONCURRENTLY` permet aux lectures de continuer pendant le refresh. Requiert un index unique (déjà en place ci-dessus).

Cron route : `apps/web/src/app/api/cron/refresh-analytics-views/route.ts` — appelée par Vercel Cron, vérifie le secret `CRON_SECRET`.

```ts
// vercel.json
{
  "crons": [
    { "path": "/api/cron/refresh-analytics-views?level=hourly",  "schedule": "*/15 * * * *" },
    { "path": "/api/cron/refresh-analytics-views?level=daily",   "schedule": "5 * * * *" }
  ]
}
```

## 4. Tables nouvelles — A/B (anticipation)

> **Crées dès la phase 1** même si l'UI A/B vient en V2. Les tables sont vides et indolores ; la convention `tracking_events_log.experiment_id` est ainsi figée dès le départ.

### 4.1 `experiments`

```sql
-- Migration 0056_experiments.sql
CREATE TABLE experiments (
  id              text PRIMARY KEY,           -- 'exp_pricing_v2_kit' (lisible, slugifié)
  name            text NOT NULL,
  hypothesis      text,                        -- "Promo en MAD vs %, on s'attend à +15 % conversion."
  status          text NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'finished', 'archived')),
  primary_metric  text NOT NULL,               -- 'purchase_rate' | 'add_to_cart_rate' | 'click_through_rate'
  unit            text NOT NULL DEFAULT 'session' CHECK (unit IN ('session', 'user', 'pageview')),
  target_pages    text[],                      -- ['/kit'] (NULL = global)
  target_devices  text[],                      -- ['mobile'] (NULL = tout)
  traffic_split   jsonb NOT NULL,              -- { "control": 0.5, "variantA": 0.5 }
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_by      uuid REFERENCES admin_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exp_status ON experiments(status);
```

### 4.2 `experiment_variants`

```sql
CREATE TABLE experiment_variants (
  id              text PRIMARY KEY,           -- 'exp_pricing_v2_kit:variantA'
  experiment_id   text NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  key             text NOT NULL,              -- 'control' | 'variantA' | 'variantB'
  label           text NOT NULL,
  payload         jsonb NOT NULL,             -- shape libre lu côté composant ({ pricingDisplay: 'percent' })
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, key)
);
```

### 4.3 `experiment_assignments`

> Une ligne par session × expérimentation. Permet de figer l'assignation dès la première visite et de garantir la cohérence cross-page.

```sql
CREATE TABLE experiment_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id   text NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_key     text NOT NULL,
  anonymous_id    text NOT NULL,
  session_id      text NOT NULL,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, anonymous_id)        -- même utilisateur = même variante à vie
);

CREATE INDEX idx_ea_anon ON experiment_assignments(anonymous_id);
CREATE INDEX idx_ea_session ON experiment_assignments(session_id);
```

### 4.4 Convention d'usage (déjà disponible côté events)

Dès qu'un utilisateur entre dans une expé, le client (`TrackingClient`) injecte automatiquement `experiment_id` dans le payload de **tous les events suivants** de la session, et la colonne `tracking_events_log.experiment_id` est remplie à l'ingest. Pour analyser une expé, l'admin pourra filtrer naturellement.

```ts
// Pseudo-code (côté client, à implémenter en V2)
const variant = await getVariant(experimentId, anonymousId);
trackingClient.setExperimentContext(experimentId, variant.key);
// → toutes les emit() suivantes embarquent experiment_id + variant_key
```

## 5. Normalisation traffic source

### 5.1 Algorithme

Source : `lib/analytics/attribution.ts` (nouveau fichier).

```ts
export type TrafficSource = 'google' | 'meta' | 'tiktok' | 'snapchat' | 'pinterest' | 'email' | 'affiliate' | 'direct' | 'other';
export type TrafficMedium = 'cpc' | 'organic' | 'social' | 'email' | 'referral' | 'direct';

export interface AttributionInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  referrer?: string | null;
}

export function classifyTraffic(input: AttributionInput): { source: TrafficSource; medium: TrafficMedium } {
  const us = (input.utmSource ?? '').toLowerCase();
  const um = (input.utmMedium ?? '').toLowerCase();
  const ref = (input.referrer ?? '').toLowerCase();

  // 1. UTM source explicite → priorité absolue (paid campaigns)
  if (us === 'google' || us === 'adwords' || us === 'gads') {
    return { source: 'google', medium: um.includes('cpc') ? 'cpc' : 'organic' };
  }
  if (us === 'meta' || us === 'facebook' || us === 'fb' || us === 'instagram' || us === 'ig') {
    return { source: 'meta', medium: 'social' };
  }
  if (us === 'tiktok' || us === 'tt') return { source: 'tiktok', medium: 'social' };
  if (us === 'snapchat' || us === 'snap') return { source: 'snapchat', medium: 'social' };
  if (us === 'pinterest') return { source: 'pinterest', medium: 'social' };
  if (us === 'newsletter' || us === 'email' || um === 'email') return { source: 'email', medium: 'email' };
  if (us === 'affiliate' || um === 'affiliate') return { source: 'affiliate', medium: 'referral' };

  // 2. Sinon, classifier par referrer
  if (!ref) return { source: 'direct', medium: 'direct' };
  if (/google\./.test(ref))                         return { source: 'google', medium: 'organic' };
  if (/(facebook|instagram|fb\.|ig\.)/.test(ref))   return { source: 'meta', medium: 'social' };
  if (/tiktok\./.test(ref))                         return { source: 'tiktok', medium: 'social' };
  if (/snapchat\./.test(ref))                       return { source: 'snapchat', medium: 'social' };
  if (/pinterest\./.test(ref))                      return { source: 'pinterest', medium: 'social' };
  if (/(youtube|twitter|t\.co|linkedin)\./.test(ref)) return { source: 'other', medium: 'social' };

  return { source: 'other', medium: 'referral' };
}
```

### 5.2 Application à l'ingest

Dans `/api/track/route.ts` (extension de quelques lignes, non breaking) :

```ts
const { source, medium } = classifyTraffic({
  utmSource: payload.utm_source,
  utmMedium: payload.utm_medium,
  referrer:  payload.page_referrer,
});

await db.insert(trackingEventsLog).values({
  // …existant…
  trafficSource: source,
  trafficMedium: medium,
  experimentId:  payload.experiment_id ?? null,
});
```

> Pour les events historiques (avant cette release), `trafficSource = NULL` → bucket "Inconnu" dans les KPIs (transparent côté UI).

## 6. Filtres d'analytics — type partagé

Source : `lib/analytics/filters.ts` (nouveau fichier).

```ts
import { z } from 'zod';

export const PERIOD_PRESETS = ['today', 'yesterday', '7d', '30d', '90d', 'all', 'custom'] as const;
export type PeriodPreset = typeof PERIOD_PRESETS[number];

export const DEVICE_VALUES = ['mobile', 'tablet', 'desktop', 'all'] as const;
export type DeviceFilter = typeof DEVICE_VALUES[number];

export const TRAFFIC_VALUES = ['all', 'direct', 'google', 'meta', 'tiktok', 'snapchat', 'pinterest', 'email', 'affiliate', 'other'] as const;
export type TrafficFilter = typeof TRAFFIC_VALUES[number];

export const AnalyticsFiltersSchema = z.object({
  period: z.enum(PERIOD_PRESETS).default('today'),
  from:   z.string().datetime().optional(),    // requis si period === 'custom'
  to:     z.string().datetime().optional(),
  device: z.enum(DEVICE_VALUES).default('mobile'),
  source: z.enum(TRAFFIC_VALUES).default('all'),
}).refine(
  (v) => v.period !== 'custom' || (!!v.from && !!v.to),
  { message: 'from/to requis quand period=custom' },
);

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;
```

## 7. Synthèse des migrations à pousser

| # | Fichier migration | Niveau de risque |
|---|---|---|
| 0050 | `tracking_events_log` ajout colonnes traffic + experiment_id | Faible (NULLABLE) |
| 0051 | `tracking_event_definitions` ajout `funnel_stage` + UPDATE seed | Faible (NULLABLE) |
| 0052 | `mv_overview_hourly` | Faible (CREATE) |
| 0053 | `mv_funnel_daily` | Faible |
| 0054 | `mv_cta_performance` | Faible |
| 0055 | `mv_checkout_steps` | Faible |
| 0056 | `experiments`, `experiment_variants`, `experiment_assignments` | Faible (CREATE) |

Ordre de déploiement : 0050 → 0051 → 0052..0055 (peuvent être en parallèle) → 0056. Le code ne dépend des matviews qu'après 0052+.

## 8. Coût estimé en stockage / IO

À 100 k events/jour (estimation conservatrice MVP) :
- `tracking_events_log` : ~60 MB/jour, ~1.8 GB/mois (jsonb compressé). Avec retention 120 j → ~7 GB. Gérable.
- `mv_overview_hourly` : ~24 lignes/heure × 24 × 4 sources × 4 devices = ~9k lignes/jour × 120 = ~1 M lignes. ~50 MB.
- Refresh `CONCURRENTLY` : surcoût lecture mineur (~5 % CPU). À surveiller en production.

## 9. RGPD & rétention

- Tous les events stockés ont `consent_snapshot` non null.
- `analytics_storage` strict : si `denied`, l'event **est stocké** (pour audit) mais **filtré** dans toutes les vues matérialisées (clauses `WHERE consent_snapshot->>'analytics_storage' = 'granted'`).
- Job de purge existant (`/api/cron/tracking-purge`) : retention 120 j sur `tracking_events_log` (réglable).
- Suppression ciblée par `anonymous_id` : route `/api/admin/tracking/forget` (à créer en V1.5 — DPO requirement).

---

**Suivant** → [`03-events-funnel-audit.md`](03-events-funnel-audit.md) : catalogue d'events, mapping TOF/MOF/BOF, audit vidéo & règles d'idempotence.
