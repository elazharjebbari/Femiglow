# Dashboards i18n — Spécification

> Spec des 4 dashboards i18n FemiGlow. Hébergés dans `/admin/i18n/dashboard?tab=<id>` (cf. `03-backend/api-routes.md` §3.1-3.2 pour les endpoints data).

## 1. TL;DR (lecture 3 min)

| Dashboard | URL | Audience principale | Refresh | Priorité |
|---|---|---|---|---|
| **1. i18n Health** | `/admin/i18n/dashboard?tab=health` | Tech lead + traducteur | 60s | P0 (ship dès Phase 1) |
| **2. i18n Adoption** | `/admin/i18n/dashboard?tab=adoption` | Founder + marketing | 5 min | P1 (Phase 4) |
| **3. i18n SEO** | `/admin/i18n/dashboard?tab=seo` | Marketing | 1h | P2 (Phase 7) |
| **4. i18n Performance** | `/admin/i18n/dashboard?tab=perf` | Tech lead | 5 min | P1 (Phase 4) |

**Pourquoi custom et pas Grafana / Metabase ?**

- Existe déjà : `/admin/*` infra (auth, layout, Tailwind tokens FemiGlow)
- Audience est très restreinte (founder + tech lead) → pas besoin de SaaS BI
- Data déjà accessible via DB Postgres + endpoints `/api/i18n/*`
- Cohérent avec la charte de la console admin

**Trade-off accepté** : pas de scheduled reports, pas d'alerting natif (on délègue à Slack webhooks).

## 2. Composants partagés

### 2.1 Header `<DashboardHeader />`

```
┌──────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — FemiGlow                            [⟳ Refresh] │
├──────────────────────────────────────────────────────────────────┤
│ [Health] [Adoption] [SEO] [Performance]              7d ▼  Live ●│
└──────────────────────────────────────────────────────────────────┘
```

Props :
- `activeTab` : 'health' | 'adoption' | 'seo' | 'perf'
- `timeRange` : '24h' | '7d' | '30d' | '90d'
- `liveMode` : boolean (re-fetch automatique selon refresh rate)

### 2.2 Widget `<KpiCard />`

```
┌──────────────────────┐
│ Coverage AR          │
│   78%                │
│   ▲ +2pp vs 7d ago   │
│   Target: ≥ 90%      │
└──────────────────────┘
```

Props :
- `title` : string
- `value` : string | number
- `delta` : number (variation vs période précédente)
- `target` : string (texte explicatif)
- `status` : 'ok' | 'warn' | 'critical' (couleur background)

### 2.3 Widget `<Sparkline />`

```
Coverage AR
████████▒▒  78%
  ┌────────────┐
  │  ╱╲  ╱╲╱╲  │
  │ ╱  ╲╱      │
  └────────────┘
  J-7         J
```

### 2.4 Widget `<Heatmap />`

```
              fr    ar    en
common      ████  ████  ████
marketing   ████  ███▒  ██▒▒
wizard      ████  ████  ███▒
legal       ████  ███▒  ██▒▒
```

### 2.5 Tableau filtrable `<MissingKeysTable />`

Colonnes : key | namespace | fr_value | locales_missing | last_used_at | [action: Translate]

## 3. Dashboard 1 — i18n Health

### 3.1 Audience et usage

- **Audience** : tech lead (quotidien), traducteur (avant push CSV)
- **Refresh** : 60s en mode "Live"
- **Question principale** : "L'i18n est-elle saine en prod ?"

### 3.2 Layout ASCII

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — Health                                       [⟳ Live ●] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROW 1 — KPIs nord-étoile (4 cards)                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Cov FR   │  │ Cov AR   │  │ Cov EN   │  │ Missing  │                  │
│  │  100%    │  │  78%     │  │  45%     │  │  key rate│                  │
│  │  ─ ─     │  │  ▲ +2pp  │  │  ▼ -1pp  │  │  0.08%   │                  │
│  │  ✅      │  │  ⚠ <90  │  │  🔴 <90  │  │  ✅ <0.1%│                  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │
│                                                                          │
│  ROW 2 — Heatmap coverage par namespace                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Coverage par namespace                                             │  │
│  │              fr    ar    en   |  common      ████  ████  ████      │  │
│  │ navigation   ████  ████  ████ |  marketing   ████  ███▒  ██▒▒      │  │
│  │ wizard       ████  ████  ███▒ |  legal       ████  ███▒  ██▒▒      │  │
│  │ admin        ████  ██▒▒  ██▒▒ |  email       ████  ████  ███▒      │  │
│  │ errors       ████  ████  ████ |  seo         ████  ███▒  ██▒▒      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 3 — Missing keys table (top 20)                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Missing keys (active, sorted by occurrences last 24h)              │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ key                            | ns       | missing in | last seen │  │
│  │ marketing.hero.cta_v2          | marketing| ar, en     | 5 min ago │  │
│  │ wizard.lead.label.email_new    | wizard   | en         | 12m ago   │  │
│  │ legal.cgv_v3.section_4         | legal    | ar, en     | 2h ago    │  │
│  │ ... (15 more)                  |          |            |           │  │
│  │                                                  [Open in TMS →]   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 4 — Sparklines historiques 30j (3 charts)                           │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ Coverage AR (30j)  │  │ Missing key rate   │  │ Reviewed % AR (30j)│  │
│  │     ╱╲             │  │       ╱╲           │  │       ╱╲           │  │
│  │    ╱  ╲            │  │      ╱  ╲          │  │      ╱  ╲          │  │
│  │   ╱    ╲___        │  │  ___╱    ╲___      │  │  ___╱    ╲___      │  │
│  │  ╱         ╲___    │  │             ╲___   │  │             ╲___   │  │
│  │ Now: 78%          │  │ Now: 0.08%         │  │ Now: 56%           │  │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Widgets en détail

#### Widget H1 — KPI cards top row

| ID | Titre | KPI ref | Color rules |
|---|---|---|---|
| H1.1 | Coverage FR | 4.1 | green si =100%, red sinon |
| H1.2 | Coverage AR | 4.1 | green ≥90%, orange 80-89%, red <80% |
| H1.3 | Coverage EN | 4.1 | green ≥90%, orange 80-89%, red <80% |
| H1.4 | Missing key rate (24h) | 5.1 | green <0.1%, orange 0.1-1%, red >1% |

**Endpoint** : `GET /api/i18n/coverage` (cf. `03-backend/api-routes.md` §3.1)

**Query example pour KPI H1.2 (Coverage AR)** :
```sql
SELECT
  100.0 * COUNT(v.key) / NULLIF((SELECT COUNT(*) FROM i18n_translation_keys WHERE is_active = true), 0) AS coverage_pct
FROM i18n_translation_values v
INNER JOIN i18n_translation_keys k ON k.key = v.key
WHERE v.locale = 'ar' AND k.is_active = true;
```

#### Widget H2 — Heatmap par namespace

Visualisation : grille `namespace × locale` avec couleur graduée 0% → 100%.

**Endpoint** : `GET /api/i18n/coverage` (champ `byNamespace`)

**Refresh** : 5 min (cache acceptable, change rarement)

#### Widget H3 — Missing keys table (top 20)

Liste paginée, tri par occurrences récentes.

**Endpoint** : `GET /api/i18n/missing-keys?locale=all&limit=20&sort=last_used_desc`

**Query SQL** :
```sql
SELECT
  k.key,
  k.namespace,
  k.context,
  k.source_value AS fr_value,
  array_agg(loc.code ORDER BY loc.code) FILTER (WHERE v.key IS NULL) AS missing_in,
  k.last_used_at
FROM i18n_translation_keys k
CROSS JOIN i18n_locales loc
LEFT JOIN i18n_translation_values v ON v.key = k.key AND v.locale = loc.code
WHERE k.is_active = true
  AND loc.enabled = true
  AND loc.code != 'fr'
GROUP BY k.key, k.namespace, k.context, k.source_value, k.last_used_at
HAVING array_length(array_agg(loc.code) FILTER (WHERE v.key IS NULL), 1) > 0
ORDER BY k.last_used_at DESC NULLS LAST
LIMIT 20;
```

**Action button** : "Open in TMS" → ouvre l'UI traduction inline (route admin existante).

#### Widget H4 — Sparklines 30j

3 sparklines :
- Coverage AR over time
- Missing key rate over time
- Reviewed % AR over time

**Source** : snapshot daily dans table `i18n_metrics_snapshots`.

**Schema** :
```sql
CREATE TABLE i18n_metrics_snapshots (
  snapshot_date DATE NOT NULL,
  locale TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  PRIMARY KEY (snapshot_date, locale, metric_name)
);
```

**Cron quotidien (3h du mat)** :
```sql
INSERT INTO i18n_metrics_snapshots (snapshot_date, locale, metric_name, metric_value)
SELECT
  CURRENT_DATE,
  v.locale,
  'coverage_pct',
  100.0 * COUNT(v.key) / NULLIF((SELECT COUNT(*) FROM i18n_translation_keys WHERE is_active = true), 0)
FROM i18n_translation_values v
INNER JOIN i18n_translation_keys k ON k.key = v.key
WHERE k.is_active = true
GROUP BY v.locale
ON CONFLICT (snapshot_date, locale, metric_name) DO UPDATE SET metric_value = EXCLUDED.metric_value;
```

### 3.4 Cas d'usage typiques

**Cas 1 — Traducteur ouvre le dashboard avant push CSV**
1. Ouvre `/admin/i18n/dashboard?tab=health`
2. Voit coverage AR à 78%
3. Click row 3 → table missing keys
4. Tri par "last_used" → 20 clés prio
5. Click "Open in TMS" sur chaque

**Cas 2 — Tech lead checks après deploy**
1. Ouvre dashboard avec timeRange=24h
2. Voit missing key rate → 0.08% ✅
3. Sparkline missing key rate → pas de spike post-deploy
4. Coverage stable ✅

## 4. Dashboard 2 — i18n Adoption

### 4.1 Audience et usage

- **Audience** : founder (weekly review), marketing
- **Refresh** : 5 min (data GA4 / tracking_events_log)
- **Question principale** : "Qui utilise quelle langue ? L'AR/EN décollent-ils ?"

### 4.2 Layout ASCII

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — Adoption                              7d ▼      [⟳]    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROW 1 — Donut + cards (4 widgets)                                       │
│  ┌──────────────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Sessions par locale  │  │ FR 72%   │  │ AR 19%   │  │ EN  9%   │      │
│  │      ╱──╲            │  │ 14 250   │  │ 3 750    │  │ 1 780    │      │
│  │     │   │  FR 72%    │  │ ▲ +3%    │  │ ▲ +8%    │  │ ▼ -2%    │      │
│  │     │   │  AR 19%    │  │ Target   │  │ Target   │  │ Target   │      │
│  │      ╲──╱  EN  9%    │  │  70%     │  │  20%     │  │  10%     │      │
│  └──────────────────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                          │
│  ROW 2 — Time series sessions par locale (30j)                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Sessions par locale (30j)              [● FR] [● AR] [● EN]        │  │
│  │                                                                    │  │
│  │ 3000 ┤                                                  ╱─╲ FR     │  │
│  │      │              ╱╲       ╱─╲    ╱─╲    ╱─╲    ╱─╲╱     ╲      │  │
│  │ 2000 ┤        ╱─╲╱─╱  ╲╱─╲╱─╱   ╲╱─╲                                │  │
│  │      │  ╱─╲╱─╱                                                     │  │
│  │ 1000 ┤─╱                                                           │  │
│  │      │                                                AR ........  │  │
│  │  500 ┤ AR _________________................................. AR   │  │
│  │      │ EN ........................................ EN              │  │
│  │    0 └─────────────────────────────────────────────────────────────│  │
│  │      Apr 27                                                  May 27│  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 3 — Switcher analysis (3 widgets)                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐    │
│  │ Switcher usage rate  │  │ Top transitions      │  │ Drop-off     │    │
│  │   6.4%               │  │ fr → ar    520 (45%) │  │ post-switch  │    │
│  │   ▲ +0.4pp           │  │ ar → fr    310 (27%) │  │   8.2%       │    │
│  │   ✅ in 3-8% range  │  │ fr → en    180 (16%) │  │   ✅ < 10%   │    │
│  │                      │  │ en → fr    140 (12%) │  │              │    │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘    │
│                                                                          │
│  ROW 4 — Adoption par source/device                                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Funnel par locale (7d)                                             │  │
│  │                                                                    │  │
│  │              FR              AR              EN                    │  │
│  │ session ████████████ 14250 ████ 3750 ███ 1780                     │  │
│  │ view kit ████████ 9800     ███ 2500 ██  1100                       │  │
│  │ checkout ████ 4200          ██ 1100 █   480                        │  │
│  │ purchase ██ 1850            █ 360   ▌ 160                          │  │
│  │ Conv:     13%               9.6%    9%                             │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Widgets en détail

#### Widget A1 — Donut sessions

**Endpoint** : `GET /api/i18n/analytics/adoption?period=7d`

**Query** :
```sql
SELECT
  payload->>'locale' AS locale,
  COUNT(DISTINCT session_id) AS sessions
FROM tracking_events_log
WHERE event_name = 'page_view'
  AND occurred_at > NOW() - INTERVAL '7 days'
  AND payload->>'locale' IS NOT NULL
GROUP BY locale
ORDER BY sessions DESC;
```

#### Widget A2 — Time series

Chart line, 3 séries (FR, AR, EN), buckets daily.

**Query** :
```sql
SELECT
  DATE_TRUNC('day', occurred_at)::date AS day,
  payload->>'locale' AS locale,
  COUNT(DISTINCT session_id) AS sessions
FROM tracking_events_log
WHERE event_name = 'page_view'
  AND occurred_at > NOW() - INTERVAL '30 days'
GROUP BY day, locale
ORDER BY day, locale;
```

#### Widget A3 — Switcher usage rate

KPI 7.1 (cf. `kpis.md` §7.1).

**Status colors** :
- 3-8% : green ✅
- < 3% ou 8-15% : orange ⚠
- > 15% : red 🔴 (signale détection défaillante)

#### Widget A4 — Top transitions

**Query** :
```sql
SELECT
  payload->>'from' AS from_locale,
  payload->>'to' AS to_locale,
  COUNT(*) AS switches
FROM tracking_events_log
WHERE event_name = 'locale_changed_manually'
  AND occurred_at > NOW() - INTERVAL '7 days'
GROUP BY from_locale, to_locale
ORDER BY switches DESC
LIMIT 10;
```

#### Widget A5 — Drop-off post-switch

KPI 7.4 (cf. `kpis.md` §7.4).

#### Widget A6 — Funnel par locale

5 étapes : session_start → view_item → begin_checkout → lead_submitted → purchase

**Source** : GA4 funnel exploration export (CSV import quotidien) OU computed depuis `tracking_events_log` + `orders` table.

**Query (custom)** :
```sql
WITH funnel AS (
  SELECT
    payload->>'locale' AS locale,
    session_id,
    MAX(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS s1_session,
    MAX(CASE WHEN event_name = 'view_kit' THEN 1 ELSE 0 END) AS s2_view,
    MAX(CASE WHEN event_name = 'begin_checkout' THEN 1 ELSE 0 END) AS s3_checkout,
    MAX(CASE WHEN event_name = 'lead_submitted' THEN 1 ELSE 0 END) AS s4_lead,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS s5_purchase
  FROM tracking_events_log
  WHERE occurred_at > NOW() - INTERVAL '7 days'
  GROUP BY locale, session_id
)
SELECT
  locale,
  SUM(s1_session) AS sessions,
  SUM(s2_view) AS view_kit,
  SUM(s3_checkout) AS checkout,
  SUM(s4_lead) AS lead,
  SUM(s5_purchase) AS purchase,
  ROUND(100.0 * SUM(s5_purchase) / NULLIF(SUM(s1_session), 0), 1) AS conv_rate
FROM funnel
WHERE locale IS NOT NULL
GROUP BY locale;
```

### 4.4 Cas d'usage typiques

**Cas 1 — Founder revue lundi 10h**
1. Ouvre `/admin/i18n/dashboard?tab=adoption&range=7d`
2. Donut : AR à 19% ✅ proche target 20%
3. Time series : AR croissant tendance ✅
4. Funnel : AR conversion 9.6% vs FR 13% → ratio 0.74 ⚠ (target 0.8)
5. Décision : investiguer copy AR du `/checkout/lead`

**Cas 2 — Marketing pré-campagne**
1. Range 30d
2. Top transitions : 45% fr→ar → audience marocaine forte
3. Décision : campagne Meta ciblée Maroc en AR

## 5. Dashboard 3 — i18n SEO

### 5.1 Audience et usage

- **Audience** : marketing, SEO
- **Refresh** : 1h (cache GSC API 48h en réalité)
- **Question principale** : "Google nous voit-il correctement en AR/EN ?"

### 5.2 Layout ASCII

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — SEO                                  28d ▼     [⟳]     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROW 1 — Impressions par locale (3 cards)                                │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐    │
│  │ Impressions FR       │  │ Impressions AR       │  │ Impressions  │    │
│  │   28 540             │  │   1 320              │  │ EN           │    │
│  │   ▲ +5% (28d)        │  │   ▲ +15% (28d)       │  │   650        │    │
│  │   CTR: 4.2%          │  │   CTR: 3.1%          │  │   ▲ +8%      │    │
│  │   Avg pos: 12.3      │  │   Avg pos: 18.7      │  │   CTR: 2.4%  │    │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘    │
│                                                                          │
│  ROW 2 — Time series impressions GSC (90j)                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Impressions GSC (90j)                  [● FR] [● AR] [● EN]        │  │
│  │                                                                    │  │
│  │ FR ████████████████████████████████████████████████████████████    │  │
│  │ AR ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    │  │
│  │ EN ............................................................    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 3 — Indexation status (3 widgets)                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐    │
│  │ Pages indexées       │  │ Hreflang valid       │  │ Sitemap      │    │
│  │ FR  142/142 ✅       │  │ FR ████████ 100% ✅  │  │ submitted    │    │
│  │ AR  135/142 ⚠ -7%    │  │ AR ████████ 100% ✅  │  │  /fr/sitemap │    │
│  │ EN  128/142 ⚠ -10%   │  │ EN ███████▒  98% ⚠   │  │  /ar/sitemap │    │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘    │
│                                                                          │
│  ROW 4 — Top queries par locale (table)                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Top 10 queries par locale (28d)                                    │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ Locale | Query                       | Impr  | CTR | Pos           │  │
│  │ fr     | "rituel beauté maroc"        | 5230  | 5%  | 8.1           │  │
│  │ fr     | "kit cosmétique femme"       | 3120  | 4%  | 12            │  │
│  │ ar     | "روتين العناية بالبشرة"     | 420   | 3%  | 18            │  │
│  │ ar     | "كيت تجميل"                 | 280   | 4%  | 22            │  │
│  │ en     | "moroccan beauty ritual"     | 180   | 2%  | 25            │  │
│  │ ... (more)                                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 5 — Hreflang errors (si any)                                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ Hreflang issues (GSC International Targeting)                    │  │
│  │ ────────────────────────────────────────────────────────────────── │  │
│  │ 3 pages without `x-default` hreflang:                              │  │
│  │   /en/legal/cgv                                                    │  │
│  │   /en/legal/mentions                                               │  │
│  │   /en/contact                                                      │  │
│  │ → [Fix in code]                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Widgets en détail

#### Widget S1 — KPI cards impressions par locale

**Endpoint** : `GET /api/i18n/seo/impressions?period=28d` (proxy GSC API)

**Backend logic** :
```typescript
// apps/web/src/app/api/i18n/seo/impressions/route.ts (REF, pas à shipper ici)
import { google } from 'googleapis';

const searchconsole = google.searchconsole({
  version: 'v1',
  auth: gcpAuth,
});

const result = await searchconsole.searchanalytics.query({
  siteUrl: 'sc-domain:femiglow.ma',
  requestBody: {
    startDate: start,
    endDate: end,
    dimensions: ['page'],
  },
});

// Group by locale prefix
const byLocale = groupByLocalePrefix(result.data.rows);
```

**Cache** : 1h dans Redis OR 24h (GSC update lag).

#### Widget S2 — Time series impressions

Endpoint identique avec `dimensions: ['date', 'page']`.

#### Widget S3 — Pages indexées

**Source** : GSC URL Inspection API (`urlInspection.index.inspect`)

OR **simple** : crawl sitemap puis test chacune via `urlInspection`.

**Query stocké** :
```sql
SELECT
  CASE
    WHEN url LIKE '/fr/%' THEN 'fr'
    WHEN url LIKE '/ar/%' THEN 'ar'
    WHEN url LIKE '/en/%' THEN 'en'
  END AS locale,
  COUNT(*) FILTER (WHERE index_status = 'PASS') AS indexed,
  COUNT(*) AS total
FROM seo_index_status
WHERE checked_at > NOW() - INTERVAL '7 days'
GROUP BY locale;
```

(Table `seo_index_status` à créer en Phase 7 si on veut suivre.)

#### Widget S4 — Hreflang validation

**Source** : GSC International Targeting report (API ou scrape weekly).

#### Widget S5 — Top queries

**Endpoint** : `GET /api/i18n/seo/queries?locale=ar&limit=10`

**GSC API call** :
```typescript
const result = await searchconsole.searchanalytics.query({
  siteUrl: 'sc-domain:femiglow.ma',
  requestBody: {
    startDate, endDate,
    dimensions: ['query', 'page'],
    dimensionFilterGroups: [{
      filters: [{ dimension: 'page', operator: 'contains', expression: `/${locale}/` }],
    }],
    rowLimit: 10,
  },
});
```

#### Widget S6 — Hreflang errors

Liste pages avec erreur hreflang. Click "Fix in code" → log un ticket dans GitHub Issues (Phase 2 enhancement).

### 5.4 Cas d'usage typiques

**Cas 1 — Marketing checks growth mensuel**
1. Range 28d
2. Impressions AR +15% MoM ✅
3. CTR AR 3.1% vs target 3% ✅
4. Position moyenne AR : 18.7 → améliorable (top 10 = goal)

**Cas 2 — Tech alerté hreflang break**
1. Alerte Slack : "3 pages without x-default"
2. Ouvre dashboard SEO → row 5
3. Click "Fix in code" → ticket GH

## 6. Dashboard 4 — i18n Performance

### 6.1 Audience et usage

- **Audience** : tech lead
- **Refresh** : 5 min
- **Question principale** : "Le site est-il rapide en AR/EN comme en FR ?"

### 6.2 Layout ASCII

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dashboard i18n — Performance                          7d ▼      [⟳]     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ROW 1 — Web Vitals par locale (LCP / CLS / INP)                         │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐    │
│  │ LCP p75 (7d)         │  │ CLS p75 (7d)         │  │ INP p75 (7d) │    │
│  │ FR 2.31s ✅          │  │ FR 0.05 ✅           │  │ FR 145ms ✅  │    │
│  │ AR 2.78s ⚠ +20%      │  │ AR 0.12 ⚠            │  │ AR 168ms ✅  │    │
│  │ EN 2.42s ✅          │  │ EN 0.07 ✅           │  │ EN 152ms ✅  │    │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘    │
│                                                                          │
│  ROW 2 — LCP time series (30j)                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ LCP p75 par locale (30j)            [● FR] [● AR] [● EN]           │  │
│  │ 4s ┤                                                               │  │
│  │ 3s ┤              AR ╱╲                                            │  │
│  │ 2s ┤ FR ─────────────────                                          │  │
│  │ 1s ┤                                                               │  │
│  │ 0  └────────────────────────────────────────────────────────────  │  │
│  │    Apr 27                                                  May 27 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 3 — Bundle size par locale (last 10 builds)                         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Bundle size — messages-[locale].js (gzip)                          │  │
│  │ 30 KB ┤                                                            │  │
│  │ 25 KB ┤              fr ▓▓▓▓ ar ▓▓▓▓▓ en ▓▓▓▓                     │  │
│  │ 20 KB ┤  fr ▓▓▓▓ ar ▓▓▓▓ en ▓▓▓▓                                  │  │
│  │ 15 KB ┤                                                            │  │
│  │ 10 KB ┤                                                            │  │
│  │  5 KB ┤                                                            │  │
│  │   0   └────────────────────────────────────────────────────────  │  │
│  │       build #142  #143  #144  #145  #146  #147  #148  #149  #150 │  │
│  │ Current: fr=23KB ar=24KB en=22KB | Target: <30KB ✅              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 4 — Performance par route × locale (heatmap)                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ LCP p75 par route × locale (7d, mobile)                            │  │
│  │                  fr      ar      en                                │  │
│  │ /                2.1s ✅ 2.8s ⚠ 2.4s ✅                            │  │
│  │ /kit             2.3s ✅ 3.1s 🔴 2.5s ✅                           │  │
│  │ /checkout/lead   1.8s ✅ 2.2s ✅ 1.9s ✅                           │  │
│  │ /journal         2.5s ✅ 2.9s ⚠ 2.6s ✅                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ROW 5 — Device breakdown (3 widgets)                                    │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐    │
│  │ LCP mobile fr        │  │ LCP mobile ar        │  │ LCP mobile   │    │
│  │ 2.45s ✅             │  │ 3.10s ⚠              │  │ en           │    │
│  │ p75                  │  │ p75                  │  │ 2.61s ✅     │    │
│  └──────────────────────┘  └──────────────────────┘  └──────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Widgets en détail

#### Widget P1 — Web Vitals KPI cards

**Source** : Vercel Analytics API

```typescript
// apps/web/src/app/api/i18n/perf/web-vitals/route.ts (REF)
const result = await fetch('https://api.vercel.com/v1/web/analytics/...', {
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
});
```

**OR** custom beacon avec query SQL :
```sql
SELECT
  payload->>'locale' AS locale,
  payload->>'metric' AS metric_name,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'value')::numeric) AS p75
FROM tracking_events_log
WHERE event_name = 'web_vital'
  AND occurred_at > NOW() - INTERVAL '7 days'
  AND payload->>'metric' IN ('LCP', 'CLS', 'INP')
GROUP BY locale, metric_name;
```

**Status colors** :
- LCP : green <2.5s, orange 2.5-4s, red >4s
- CLS : green <0.1, orange 0.1-0.25, red >0.25
- INP : green <200ms, orange 200-500ms, red >500ms

#### Widget P2 — Time series LCP

Chart line 30j, 3 séries.

#### Widget P3 — Bundle size

**Source** : table `i18n_bundle_sizes` (alimentée par CI)

**Schema** :
```sql
CREATE TABLE i18n_bundle_sizes (
  build_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  size_gzip_bytes INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (build_id, locale)
);
```

**CI script (référence)** :
```yaml
# .github/workflows/track-bundle-size.yml
- name: Record bundle size
  run: |
    for LOC in fr ar en; do
      SIZE=$(stat -c%s .next/static/chunks/messages-$LOC.*.js | head -1)
      curl -X POST $DB_API/i18n/bundle-sizes \
        -d "{\"build_id\":\"${{ github.sha }}\", \"locale\":\"$LOC\", \"size_gzip_bytes\":$SIZE}"
    done
```

#### Widget P4 — Heatmap LCP route × locale

**Query** :
```sql
SELECT
  payload->>'route' AS route,
  payload->>'locale' AS locale,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'value')::numeric) AS lcp_p75
FROM tracking_events_log
WHERE event_name = 'web_vital'
  AND payload->>'metric' = 'LCP'
  AND payload->>'device' = 'mobile'
  AND occurred_at > NOW() - INTERVAL '7 days'
GROUP BY route, locale
ORDER BY route, locale;
```

#### Widget P5 — Device breakdown

Filtré sur mobile only. 3 cards (FR / AR / EN).

### 6.4 Cas d'usage typiques

**Cas 1 — Tech lead daily check**
1. Ouvre dashboard perf
2. LCP AR p75 = 2.78s ⚠ (cible <2.75s)
3. Heatmap row 4 : `/kit` AR = 3.1s 🔴 → root cause `/kit` en AR
4. Investigate : image hero AR différente ? RTL flip causant reflow ?
5. Ticket prio

**Cas 2 — Post-deploy regression**
1. Sparkline LCP AR : spike ↑ depuis 1h ⚠
2. Cross-check Vercel deployments : nouveau deploy il y a 1h15
3. Rollback ou hotfix

## 7. Implémentation technique

### 7.1 Stack

- **Frontend** : Next.js Server Component pour `/admin/i18n/dashboard/page.tsx`
- **Data fetching** : `fetch('/api/i18n/coverage')` côté server
- **Charts** : `recharts` (déjà dans le projet pour autres dashboards admin)
- **Refresh live** : `useEffect` + `setInterval(60_000)` pour tab Health
- **Auth** : middleware `requireAdmin()` (déjà utilisé)

### 7.2 Endpoints requis

| Endpoint | Dashboard | Spec |
|---|---|---|
| `GET /api/i18n/coverage` | Health | Cf. `03-backend/api-routes.md` §3.1 |
| `GET /api/i18n/missing-keys` | Health | Cf. `03-backend/api-routes.md` §3.2 |
| `GET /api/i18n/analytics/adoption?period=7d` | Adoption | Nouveau (Phase 4) |
| `GET /api/i18n/analytics/switcher?period=7d` | Adoption | Nouveau (Phase 4) |
| `GET /api/i18n/analytics/funnel?period=7d` | Adoption | Nouveau (Phase 4) |
| `GET /api/i18n/seo/impressions?period=28d` | SEO | Nouveau (Phase 7) — proxy GSC |
| `GET /api/i18n/seo/queries?locale=ar` | SEO | Nouveau (Phase 7) |
| `GET /api/i18n/seo/hreflang-issues` | SEO | Nouveau (Phase 7) |
| `GET /api/i18n/perf/web-vitals?period=7d` | Performance | Nouveau (Phase 4) |
| `GET /api/i18n/perf/bundle-sizes` | Performance | Nouveau (Phase 4) |

### 7.3 Caching strategy

| Dashboard | Endpoint cache | Stale-while-revalidate |
|---|---|---|
| Health | 60s | 30s |
| Adoption | 5 min | 2 min |
| SEO | 1h | 30 min |
| Performance | 5 min | 2 min |

### 7.4 Pagination & filters

- Missing keys table : paginated (20 per page), filter by namespace, search by key
- Top queries : top 100, paginated 20

### 7.5 Export / share

- Bouton "Export CSV" sur tableau missing keys
- Bouton "Snapshot share" qui génère lien `/admin/i18n/dashboard/snapshot/[id]` (read-only, 7j TTL) → utile pour partager avec traducteur freelance

## 8. Mockup visuel détaillé — Dashboard Health (desktop)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ FemiGlow Admin                                            👤 Founder | 🔔 3 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Sidebar          │  Dashboard i18n — Health                        Live ●  ║
║  ───────          │  ──────────────────────────────────────────────────────  ║
║  Dashboard        │  [Health] Adoption  SEO  Performance     Range: 7d ▼    ║
║  Orders           │                                                          ║
║  Products         │  Coverage           Coverage           Coverage          ║
║  ▸ I18n           │  ┌────────────┐    ┌────────────┐    ┌────────────┐     ║
║    Languages      │  │ FR         │    │ AR         │    │ EN         │     ║
║    Translations   │  │ 100%       │    │ 78%        │    │ 45%        │     ║
║    Dashboard ←─── │  │ ─ baseline │    │ ▲ +2pp     │    │ ▼ -1pp     │     ║
║    Reviews        │  │ ✅ source  │    │ ⚠ <90%    │    │ 🔴 <90%   │     ║
║  Users            │  └────────────┘    └────────────┘    └────────────┘     ║
║  Logs             │                                                          ║
║                   │  Missing key rate (24h)                                  ║
║                   │  ┌────────────┐                                          ║
║                   │  │ 0.08%      │                                          ║
║                   │  │ ✅ <0.1%   │                                          ║
║                   │  └────────────┘                                          ║
║                   │                                                          ║
║                   │  Coverage par namespace                                  ║
║                   │  ┌────────────────────────────────────────────────────┐  ║
║                   │  │           fr     ar     en                          │  ║
║                   │  │ common    100%   100%   95%   ████████████          │  ║
║                   │  │ marketing 100%   80%    50%   ████ ▒▒▒              │  ║
║                   │  │ wizard    100%   100%   85%   ████ ▒                │  ║
║                   │  │ legal     100%   65%    40%   ▒▒▒▒                  │  ║
║                   │  │ admin     100%   50%    50%   ▒▒                    │  ║
║                   │  │ email     100%   90%    70%   ████ ▒                │  ║
║                   │  │ errors    100%   100%   100%  ████████████          │  ║
║                   │  │ seo       100%   85%    60%   ████ ▒                │  ║
║                   │  └────────────────────────────────────────────────────┘  ║
║                   │                                                          ║
║                   │  Top 20 missing keys (last 24h)         [Export CSV]    ║
║                   │  ┌────────────────────────────────────────────────────┐  ║
║                   │  │ Key                       NS         Missing  Seen │  ║
║                   │  │ marketing.hero.cta_v2    marketing  ar, en   5min │  ║
║                   │  │ wizard.lead.label.foo    wizard     en       12m  │  ║
║                   │  │ legal.cgv_v3.s4          legal      ar, en   2h   │  ║
║                   │  │ ...                                                 │  ║
║                   │  └────────────────────────────────────────────────────┘  ║
║                   │                                                          ║
║                   │  Trends (30j)                                            ║
║                   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      ║
║                   │  │ Cov AR 30d  │  │ Miss key %  │  │ Reviewed AR │      ║
║                   │  │     ╱╲      │  │     ╱╲      │  │     ╱╲      │      ║
║                   │  │   ╱  ╲___   │  │   ╱  ╲___   │  │   ╱  ╲___   │      ║
║                   │  │ 78%         │  │ 0.08%       │  │ 56%         │      ║
║                   │  └─────────────┘  └─────────────┘  └─────────────┘      ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 9. Mobile responsive

Dashboards optimisés desktop d'abord. Sur mobile :
- Sidebar collapse
- KPI cards 1 colonne (au lieu de 3-4)
- Tables horizontalement scrollable
- Charts simplified (line only, pas multi-séries)

→ Le dashboard est interne, audience principale est desktop. Mobile = best effort.

## 10. Pièges dashboards

| Piège | Conséquence | Remède |
|---|---|---|
| **Trop de widgets** | Dashboard illisible, personne ne regarde | Max 6 widgets par tab. Choisir avec rigueur |
| **Refresh trop fréquent** | Charge DB, coût Vercel | Cache backend obligatoire |
| **Pas de baseline / target affiché** | Impossible de juger si chiffre est bon | Toujours afficher target + couleur status |
| **Pas de drill-down** | "Pourquoi AR coverage à 78%" → bloqué | Click sur card ouvre detail view |
| **Pas de timestamp data** | Doute sur fraîcheur | Footer "Updated 2 min ago" obligatoire |
| **Charts sans contexte** | Spike interprétable | Tooltip avec contexte (deploy, holiday, etc.) |
| **Pas de comparaison période** | "Bon ou mauvais ?" | Always show delta vs prev period |
| **Confondre coverage et reviewed** | Faux sentiment de progrès | 2 widgets distincts toujours |

## 11. Évolution dashboards par phase

| Phase | Dashboards actifs | Notes |
|---|---|---|
| Phase 1 — Foundation | Health (KPI cards seulement) | Pas de charts, juste 4 cards |
| Phase 2 — Content extraction | Health complet | Add table + heatmap |
| Phase 4 — RTL + AR | + Performance | Web Vitals par locale |
| Phase 4 — RTL + AR | + Adoption (partiel) | Donut + time series |
| Phase 5 — Workflow translateur | + Adoption (switcher) | Switcher analysis section |
| Phase 7 — Deploy + obs | + SEO | Full GSC integration |

## 12. Owners + permissions

| Dashboard | Lecture | Édition / refresh manuel |
|---|---|---|
| Health | Admin, Translator | Admin |
| Adoption | Admin only | Admin |
| SEO | Admin, Marketing role | Admin |
| Performance | Admin only | Admin |

**Note** : pas de role "Translator" actuel — créer Phase 5 si besoin.

## 13. Checklist setup dashboards

- [ ] Route `/admin/i18n/dashboard/page.tsx` créée
- [ ] Tabs Health / Adoption / SEO / Performance routables via query param
- [ ] Composants partagés (`KpiCard`, `Heatmap`, `Sparkline`, `MissingKeysTable`) créés
- [ ] Endpoints `/api/i18n/coverage` + `/api/i18n/missing-keys` reachable
- [ ] Refresh interval configurable et testé
- [ ] Mode Live togglable
- [ ] Range selector fonctionne (24h, 7d, 30d, 90d)
- [ ] Footer "Updated X ago" affiché
- [ ] Status colors documentées et conformes design system
- [ ] Mobile responsive testé (1 colonne KPI cards)
- [ ] Permission middleware fonctionne (404 si non-admin)
- [ ] Bouton Export CSV sur table missing keys fonctionne
- [ ] Cron table `i18n_metrics_snapshots` populée
- [ ] Doc utilisateur "Comment lire le dashboard" dans `09-runbook/`

---

→ Prochaine lecture : [`alerts.md`](./alerts.md)
