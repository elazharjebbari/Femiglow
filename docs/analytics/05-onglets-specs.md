# 05 — Specs détaillées par onglet

> Pour chaque onglet : KPI exhaustifs, queries SQL/Drizzle, layout, edge cases, instrumentation requise. Les composants visés sont définis dans `04-ui-design.md`. Les vues matérialisées dans `02-data-model.md`. Les events dans `03-events-funnel-audit.md`.

## §1 — Vue d'ensemble (`/admin/analytics`)

### 1.1 Question business

> *« Combien de personnes viennent, qui sont-elles, et combien achètent ? »*

### 1.2 KPI principaux (6 cards en haut)

| # | KPI | Définition | Source | Format |
|---|---|---|---|---|
| 1 | **Sessions** | Sessions distinctes (`session_id` unique) | `mv_overview_hourly.sessions` | number |
| 2 | **Visiteurs uniques** | `anonymous_id` distincts | `mv_overview_hourly.unique_visitors` | number |
| 3 | **Pages vues** | Total `page_view` events | `mv_overview_hourly.page_views` | number |
| 4 | **Durée session moyenne** | `SUM(session_duration_s) / sessions` | dérivé de `session_id` min/max timestamps | duration mm:ss |
| 5 | **Taux de rebond** | `bounce_sessions / sessions` | `mv_overview_hourly.bounce_sessions` | percent |
| 6 | **Taux de conversion** | `purchases / sessions` | `mv_overview_hourly.purchases` | percent |

> Chaque KPI affiche un **delta** vs. la période précédente comparable (ex : si filtre = "7j", delta vs. "j-14 → j-8"). Format : `↑ 12,4 %` (vert), `↓ 3,1 %` (rouge), `→ 0 %` (gris).

### 1.3 KPI secondaires (sous le fold)

| KPI | Calcul | Affichage |
|---|---|---|
| Revenu | `SUM(payload->>'value' WHERE event_name = 'purchase')` | KPI compact sous Top sources |
| Panier moyen (AOV) | `revenu / purchases` | KPI compact |
| Add-to-cart rate | `add_to_cart_sessions / view_item_sessions` | Mini-card |
| Begin-checkout rate | `begin_checkout_sessions / add_to_cart_sessions` | Mini-card |

### 1.4 Graphs

#### A. Sessions par jour (LineChart, 8 cols)

- **Données** : `mv_overview_hourly` agrégé au jour selon période, avec série secondaire `comparison_previous_period` en pointillés brume.
- **Séries** : `sessions` (sauge plein) + `sessions_period_avant` (brume pointillé).
- **Axe X** : timestamps formattés selon période (heure si "Aujourd'hui", jour sinon, semaine si "90j").
- **Axe Y** : auto, `domain: ['auto', 'auto']`, `tickFormatter: formatNumber`.
- **Tooltip** : multi-line, affiche `+X.X% vs avant` calculé point-à-point.

```sql
-- Query Vue d'ensemble — Sessions par jour (Drizzle pseudo)
SELECT
  date_trunc('day', bucket) AS day,
  SUM(sessions) AS sessions
FROM mv_overview_hourly
WHERE bucket >= $from AND bucket < $to
  AND ($device IS NULL OR device = $device)
  AND ($source IS NULL OR traffic_source = $source)
GROUP BY 1
ORDER BY 1;
```

#### B. Top sources (DataTable + Donut, 4 cols)

- Ranking : sources triées par `sessions` desc, top 5 + "Autre" agrégé.
- Affichage : Donut (couleurs brand) + table avec sessions et CR par source.

#### C. CR par jour (LineChart, 6 cols)

- Série unique `cr` en ciel.
- `cr = purchases / sessions` calculé par jour.
- Annotation visuelle si CR < 0.5 % (zone amber légère, sans alerter agressivement).

#### D. Top pages (DataTable, 6 cols)

- Colonnes : `page_route`, `page_views`, `sessions`, `bounce_rate`, `cr` (avec bar inline).
- Pagination 20 / page.
- Click row → ouvre filtres pré-remplis (drilldown via URL).

### 1.5 Layout final

```
[6 KPI cards] (12 cols, grid-cols-6 desktop, 2 mobile)

[Sessions / jour    8 cols] [Top sources 4 cols]
[CR / jour          6 cols] [Top pages   6 cols]
[Revenu mini   2c] [AOV mini 2c] [ATC% 2c] [BeginCO% 2c]
```

### 1.6 Edge cases

| Cas | Comportement |
|---|---|
| Aucune donnée sur la période | Tous les KPI affichent `—`. Charts en EmptyState. Pas d'erreur. |
| Période = "Aujourd'hui" avant 6h | Chart pas vide mais visiblement court. OK. |
| Custom range > 365 jours | UI limite côté client. Server retourne 400 si tentative. |
| Bounce sans `session_duration` connue | On suppose 0 s = bounce. |
| Données non à jour (matview lag > 30 min) | Bandeau discret "Mises à jour il y a 32 min" en haut. |

### 1.7 Instrumentation côté admin (suivi de l'usage admin)

L'admin lui-même est tracké pour diagnostiquer l'usage du dashboard :
- `admin_analytics_tab_view` (overview / live / funnel / cta / checkout)
- `admin_analytics_filter_change` (avec quel filtre, quelle valeur)
- `admin_analytics_export_csv` (depuis quel tableau)

> Catégorie `admin`. Filtre out de tous les KPI publics (déjà géré par `consent_snapshot.analytics_storage`).

## §2 — Live (`/admin/analytics/live`)

### 2.1 Question business

> *« Que se passe-t-il maintenant ? Le funnel se passe-t-il correctement ? »*

### 2.2 Mécanisme : SSE + polling fallback

#### SSE primary

```ts
// /api/admin/analytics/live/stream/route.ts
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await requireAdmin();
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        const snapshot = await readLiveSnapshot();
        controller.enqueue(`data: ${JSON.stringify(snapshot)}\n\n`);
      }, 5000);
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' },
  });
}
```

#### Polling fallback (SWR)

Si SSE ferme 3 fois en 30 s, on bascule en `useSWR('/api/admin/analytics/live', { refreshInterval: 5000 })`. Hook : `useAnalyticsSSE()` encapsule la logique.

### 2.3 KPI BIG (3 cards XL)

| # | KPI | Définition | Window |
|---|---|---|---|
| 1 | **En ligne** | `COUNT(DISTINCT session_id) WHERE received_at > now() - interval '5 min'` | 5 min |
| 2 | **Conversions** | `COUNT(*) WHERE event_name = 'purchase' AND received_at > now() - interval '$window'` | 1h / 2h / 3h (sélecteur) |
| 3 | **CTA achat** | `COUNT(*) WHERE event_name = 'cta_click' AND payload->>'cta_intent' = 'purchase' AND received_at > now() - interval '$window'` | 1h / 2h / 3h |

### 2.4 Panneaux secondaires

#### A. En ligne par page (DataTable rolling)

```sql
SELECT
  page_route,
  COUNT(DISTINCT session_id) AS users
FROM tracking_events_log
WHERE received_at > now() - interval '5 min'
  AND event_name = 'page_view'
  AND consent_snapshot->>'analytics_storage' = 'granted'
GROUP BY 1
ORDER BY users DESC
LIMIT 10;
```

#### B. Par source (Donut)

`SUM(distinct session_id) GROUP BY traffic_source` sur 1h glissante.

#### C. Par device (Donut)

Idem GROUP BY `device`.

#### D. Stream événements (LiveEventStream)

- Buffer 100 events côté client (FIFO).
- Filtrable par catégorie (engagement / commerce / form / video / admin).
- Pause/Resume button.
- Highlight 800 ms à l'arrivée d'un nouveau event.
- Format : `[hh:mm:ss]` `event_name` (mono badge) `page_route` (path) `device` `· FR/EN`.
- Clic sur ligne → ouvre side panel avec `payload` JSON pretty.

#### E. Funnel TOF/MOF/BOF live (1h glissante)

```sql
SELECT
  funnel_stage,
  COUNT(DISTINCT session_id) AS sessions
FROM tracking_events_log e
JOIN tracking_event_definitions d USING (event_name)
WHERE received_at > now() - interval '1 hour'
  AND consent_snapshot->>'analytics_storage' = 'granted'
GROUP BY funnel_stage
ORDER BY CASE funnel_stage
  WHEN 'tof' THEN 1
  WHEN 'mof' THEN 2
  WHEN 'bof' THEN 3
  WHEN 'conversion' THEN 4
END;
```

Affichage : `<FunnelStepper orientation="horizontal" steps={[…]}>`.

### 2.5 Layout

```
[BIG: Online · Conv · CTA]  (3 × 4 cols)
[Par page 4c] [Par source 4c] [Par device 4c]
[LiveEventStream 12 cols, h-96]
[Funnel TOF/MOF/BOF live 12 cols]
```

### 2.6 Edge cases

| Cas | Comportement |
|---|---|
| 0 utilisateurs en ligne | Pastille grise au lieu de rouge, "0 en ligne" pas vide |
| SSE déconnecté > 30 s | Bandeau "Connexion temps réel perdue · reconnexion…" + auto-retry exponentiel (1s, 2s, 4s, max 16s) |
| Event invalide reçu | Drop côté client (warn console), pas d'affichage cassé |
| Onglet en background | Throttle SSE à 30 s (Page Visibility API) |
| Plus de 1000 events/min | Sampling 1/10 affichage stream (pas dans les KPI qui restent exhaustifs) |

### 2.7 Performance

- SSE multiplexé : 1 connexion par admin, partagée via BroadcastChannel si plusieurs onglets ouverts.
- Snapshot serveur en cache mémoire 1 s (évite floor sur DB si N admins simultanés).
- Index `idx_tel_received_at` (cf. `02-data-model.md`) garantit `< 50 ms` pour les fenêtres glissantes.

## §3 — Funnel (`/admin/analytics/funnel`)

### 3.1 Question business

> *« Où décrochent les utilisateurs ? Quel est le levier d'optimisation prioritaire ? »*

### 3.2 Funnel principal (5 étapes)

| Stage | Event(s) déclencheur(s) | Définition session-level |
|---|---|---|
| **View** | `page_view` sur `/kit` ou `view_item` | Session avec ≥ 1 vue produit |
| **Engage** | `scroll_depth_50`, `video_user_play`, `cta_impression` | Session avec ≥ 1 engagement actif |
| **CTA** | `add_to_cart`, `cta_click[intent=purchase]` | Session avec intention d'achat |
| **Checkout** | `begin_checkout` | Session ayant initié le checkout |
| **Purchase** | `purchase` | Session avec achat |

### 3.3 KPI

| KPI | Calcul |
|---|---|
| Volume / step | Sessions ayant au moins l'event de l'étape |
| Taux de progression | `step_n / step_(n-1)` |
| Taux d'abandon par step | `1 - step_(n+1)/step_n` |
| Time to next step (médiane) | `MEDIAN(timestamp_step_(n+1) - timestamp_step_n)` par session |

### 3.4 Queries

```sql
-- Funnel global sur période
WITH session_steps AS (
  SELECT
    session_id,
    BOOL_OR(funnel_stage = 'tof' AND event_name IN ('page_view','view_item')) AS view,
    BOOL_OR(funnel_stage = 'tof' AND event_name IN ('scroll_depth_50','video_user_play','cta_impression')) AS engage,
    BOOL_OR(event_name IN ('add_to_cart','cta_click') AND payload->>'cta_intent' = 'purchase') AS cta,
    BOOL_OR(event_name = 'begin_checkout') AS checkout,
    BOOL_OR(event_name = 'purchase') AS purchase
  FROM tracking_events_log e
  LEFT JOIN tracking_event_definitions d USING (event_name)
  WHERE received_at >= $from AND received_at < $to
    AND consent_snapshot->>'analytics_storage' = 'granted'
    AND ($device IS NULL OR device = $device)
    AND ($source IS NULL OR traffic_source = $source)
  GROUP BY session_id
)
SELECT
  COUNT(*) FILTER (WHERE view) AS views,
  COUNT(*) FILTER (WHERE view AND engage) AS engages,
  COUNT(*) FILTER (WHERE view AND engage AND cta) AS ctas,
  COUNT(*) FILTER (WHERE view AND engage AND cta AND checkout) AS checkouts,
  COUNT(*) FILTER (WHERE view AND engage AND cta AND checkout AND purchase) AS purchases
FROM session_steps;
```

### 3.5 Funnel × Pages (Sankey)

```sql
-- Flux : page d'entrée → stage atteint
SELECT
  first_page,
  reached_stage,
  COUNT(DISTINCT session_id) AS volume
FROM (
  SELECT
    session_id,
    FIRST_VALUE(page_route) OVER (PARTITION BY session_id ORDER BY received_at) AS first_page,
    MAX(funnel_stage_rank) OVER (PARTITION BY session_id) AS max_stage_rank
  FROM tracking_events_log e
  LEFT JOIN tracking_event_definitions d USING (event_name)
  WHERE received_at >= $from AND received_at < $to
) sub
GROUP BY 1, 2;
```

`funnel_stage_rank` = case lookup `tof=1, mof=2, bof=3, conversion=4`. Ranking pour `MAX()`.

Affichage : `<Sankey>` Recharts (palette brand sauge → ciel → champagne → pétale).

### 3.6 Drop-off rates (BarChart)

X = stages, Y = % d'abandon entre N et N+1, couleur = brume si < 30 %, amber si 30–60 %, rose si > 60 %.

### 3.7 DataTable funnel par page

| Page | Views | View→CTA | CTA→Buy | Volume Buy |
|---|---|---|---|---|
| /kit | 8500 | 14.2% | 5.6% | 67 |
| /rituel | 1200 | 6.1% | 8.0% | 6 |
| ... | ... | ... | ... | ... |

Sortable, exportable CSV.

### 3.8 Edge cases

| Cas | Comportement |
|---|---|
| Stage non instrumenté pour une période passée | Affiche `n/a`, pas 0. (Détecté par version de migration) |
| Funnel avec étape > 100% (bug d'inversion) | Rendre le rapport en rouge + log Sentry, ne pas masquer |
| Sankey : trop de sources | Top 10 sources visibles, le reste agrégé en "Autres" |

## §4 — CTA (`/admin/analytics/cta`)

### 4.1 Question business

> *« Quels CTA convertissent ? Quel message/page mène à l'achat ? »*

### 4.2 KPI globaux (4 cards)

| # | KPI | Définition |
|---|---|---|
| 1 | Impressions CTA | `SUM(impressions)` |
| 2 | Clics CTA | `SUM(clicks)` |
| 3 | CR CTA→Achat | `SUM(purchases_after_click) / SUM(clicks)` |
| 4 | Revenu attribué | `SUM(revenue_after_click)` |

### 4.3 Tableau CTA principal

`mv_cta_performance` (cf. `02-data-model.md` §4.3) sert de source.

```sql
SELECT
  c.id AS component_id,
  c.role,
  c.label,
  c.page_route,
  m.impressions,
  m.clicks,
  m.purchases_after_click,
  m.revenue_after_click,
  m.clicks::float / NULLIF(m.impressions, 0) AS click_rate,
  m.purchases_after_click::float / NULLIF(m.clicks, 0) AS conversion_rate
FROM mv_cta_performance m
JOIN tracking_components c ON c.id = m.component_id
WHERE m.bucket_day >= $from AND m.bucket_day < $to
  AND c.role IN ('cta_primary','cta_secondary','sticky_cta')
ORDER BY m.purchases_after_click DESC NULLS LAST;
```

### 4.4 Panneaux secondaires

#### A. Top messages (BarChart horizontal)

GROUP BY `c.label` ORDER BY `purchases_after_click DESC` LIMIT 10.

Lecture : "Composer mon rituel" → 67 achats, "Découvrir le Kit" → 12 achats, etc.

#### B. Top pages → achat (DataTable)

GROUP BY `c.page_route`. Permet de mesurer quelle page d'origine convertit le mieux indépendamment du CTA exact.

### 4.5 Attribution

- Fenêtre attribuable : 7 jours après le clic (cf. `mv_cta_performance` §02).
- Modèle : last-click sur le CTA dans la session de l'achat. Si aucun CTA cliqué dans la session d'achat, on regarde la dernière session avec CTA dans les 7 derniers jours pour le même `anonymous_id`.

### 4.6 Edge cases

| Cas | Comportement |
|---|---|
| Component supprimé mais events historiques | Affiche le label en gris + "(supprimé)" |
| `clicks = 0` mais `purchases_after_click > 0` | N'affiche pas la ligne (impossible logiquement, log Sentry) |
| Multiple CTA dans une session avant achat | Le **dernier** CTA cliqué reçoit l'attribution complète |
| A/B en cours | Affichage variant-aware si `experiment_id` présent (V2) |

## §5 — Checkout (`/admin/analytics/checkout`)

### 5.1 Question business

> *« Combien de gens entrent dans le tunnel d'achat, et où décrochent-ils précisément ? »*

### 5.2 KPI (4 cards)

| # | KPI | Définition |
|---|---|---|
| 1 | Vues panier | `view_cart` distincts par session |
| 2 | Begin checkout | `begin_checkout` distincts par session |
| 3 | Soumissions | `purchase` distincts par session |
| 4 | Abandons | `begin_checkout` sans `purchase` dans les 60 min |

### 5.3 Funnel checkout fin (FunnelStepper vertical)

```
View Cart       → 234 sessions
Begin Checkout  → 145 sessions  (-38%)
Add Shipping    → 132 sessions  (-9%)
Add Payment     → 118 sessions  (-11%)
Submit          → 102 sessions  (-14%)
Purchase        → 89 sessions   (-13%)
```

Source : `mv_checkout_steps` (cf. `02-data-model.md` §4.4).

### 5.4 Panneaux secondaires

#### A. Top erreurs formulaire (DataTable)

```sql
SELECT
  payload->>'field_id' AS field_id,
  payload->>'error_code' AS error_code,
  COUNT(*) AS occurrences,
  COUNT(DISTINCT session_id) AS affected_sessions
FROM tracking_events_log
WHERE event_name = 'form_validation_error'
  AND received_at >= $from AND received_at < $to
GROUP BY 1, 2
ORDER BY occurrences DESC
LIMIT 20;
```

#### B. Time to submit (Histogramme)

```sql
WITH durations AS (
  SELECT
    session_id,
    EXTRACT(EPOCH FROM (
      MAX(received_at) FILTER (WHERE event_name = 'purchase')
      - MIN(received_at) FILTER (WHERE event_name = 'begin_checkout')
    )) AS duration_s
  FROM tracking_events_log
  WHERE event_name IN ('begin_checkout','purchase')
    AND received_at >= $from AND received_at < $to
  GROUP BY session_id
  HAVING COUNT(DISTINCT event_name) = 2
)
SELECT
  WIDTH_BUCKET(duration_s, 0, 600, 12) AS bucket,
  COUNT(*) AS sessions
FROM durations
WHERE duration_s BETWEEN 0 AND 600
GROUP BY 1
ORDER BY 1;
```

Affichage : BarChart, X = buckets de 50 s (0-50, 50-100, …, 550-600), Y = sessions. Annotations P25, P50, P75, P95 en lignes verticales.

#### C. Champs les plus abandonnés

```sql
SELECT
  payload->>'last_field_id' AS last_field,
  COUNT(*) AS abandons
FROM tracking_events_log
WHERE event_name = 'form_abandon'
  AND received_at >= $from AND received_at < $to
GROUP BY 1
ORDER BY abandons DESC
LIMIT 10;
```

> `last_field_id` est calculé côté client par `useFormTracking` à partir du dernier champ ayant reçu `form_field_blur`.

### 5.5 Layout

```
[4 KPI cards]
[FunnelStepper vertical 6c] [Time to submit histogram 6c]
[Top form errors 6c]         [Champs abandonnés 6c]
```

### 5.6 Edge cases

| Cas | Comportement |
|---|---|
| Begin checkout sans add_shipping (skip step) | OK, le step est marqué "skip" pas "drop" |
| Achat externe (Stripe redirect) | Si redirect = retour avec `purchase` event, OK. Si pas de retour, on perd l'achat → cf. webhook fallback |
| Form abandon sans `form_focus` préalable | Drop event (impossible logiquement) |
| Time-to-submit < 1 s | Probablement bot. Logger, exclure du P50/P95 |
| Time-to-submit > 30 min | Plafonner à 30 min pour éviter outliers |

### 5.7 Webhook fallback purchase

Si Stripe webhook reçoit un `payment_intent.succeeded` mais aucun `purchase` event tracké côté client (user a fermé l'onglet), on émet un `purchase_server` event côté serveur via `TrackingClient.serverEmit()`. Catégorie `commerce_server`. Filtrable mais inclus dans les KPI conversion.

## §6 — Endpoints API (récap)

| Route | Méthode | Description | Cache |
|---|---|---|---|
| `/api/admin/analytics/overview` | GET | KPI + séries Vue d'ensemble | `revalidate: 60` |
| `/api/admin/analytics/live` | GET | Snapshot live (polling fallback) | no-store |
| `/api/admin/analytics/live/stream` | GET | SSE | streamed |
| `/api/admin/analytics/funnel` | GET | Funnel global + drop-off | `revalidate: 300` |
| `/api/admin/analytics/funnel/sankey` | GET | Données Sankey funnel × pages | `revalidate: 300` |
| `/api/admin/analytics/cta` | GET | Tableau CTA + top messages | `revalidate: 300` |
| `/api/admin/analytics/checkout` | GET | Funnel + erreurs + histogramme | `revalidate: 300` |
| `/api/admin/analytics/export/csv` | GET | Export CSV générique (param `dataset`) | no-store |

Tous les endpoints :
- Auth : `requireAdmin()` (existant)
- Validation paramètres : `AnalyticsFiltersSchema` (Zod)
- Erreurs : retournent JSON `{ error: { code, message } }` avec HTTP code adapté
- Telemetry : log `admin.analytics.api` avec durée + cache hit/miss

## §7 — Module organisation

```
apps/web/src/
├── app/(admin)/admin/analytics/
│   ├── layout.tsx              # tabs + filterbar shared
│   ├── page.tsx                # Vue d'ensemble (RSC)
│   ├── live/page.tsx           # Live (RSC + client SSE)
│   ├── funnel/page.tsx
│   ├── cta/page.tsx
│   └── checkout/page.tsx
├── app/api/admin/analytics/
│   ├── overview/route.ts
│   ├── live/route.ts
│   ├── live/stream/route.ts
│   ├── funnel/route.ts
│   ├── funnel/sankey/route.ts
│   ├── cta/route.ts
│   ├── checkout/route.ts
│   └── export/csv/route.ts
├── lib/analytics/
│   ├── filters.ts              # Zod schema + parse URL
│   ├── attribution.ts          # classifyTraffic, attribution last-click
│   ├── queries/
│   │   ├── overview.ts
│   │   ├── live.ts
│   │   ├── funnel.ts
│   │   ├── cta.ts
│   │   └── checkout.ts
│   ├── format.ts               # formatNumber, formatPercent, formatDuration
│   └── sse.ts                  # helpers SSE
└── components/admin/analytics/  # cf. 04-ui-design.md §11
```

## §8 — Resilience & SLOs

| Endpoint | Cible P95 | Cible P99 | Action si dépassée |
|---|---|---|---|
| `/overview` | < 300 ms | < 600 ms | Vérifier matview lag, réindex `mv_overview_hourly` |
| `/live` | < 200 ms | < 500 ms | Vérifier index `idx_tel_received_at_session_id` |
| `/funnel` | < 800 ms | < 1500 ms | Pré-calculer matview `mv_funnel_sessions` (V2) |
| `/cta` | < 500 ms | < 1000 ms | Vérifier `mv_cta_performance` refresh |
| `/checkout` | < 600 ms | < 1200 ms | Vérifier index `payload->>'field_id'` |

> Si > 3 dépassements P99 en 5 min → log critical + Sentry alert. Pas de PagerDuty (pas critique pour business : admin only).

---

**Suite** : `06-tests-strategy.md` — patterns Vitest + MSW + Playwright + scénarios par onglet.
