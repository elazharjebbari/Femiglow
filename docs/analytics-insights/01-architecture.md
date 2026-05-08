# 01 — Architecture

> *Vue d'ensemble, couches, flux d'agrégation, boucle de refresh*

---

## 1. Vue d'ensemble

```
┌────────────────────── Source : tracking_events_log (Postgres) ──────────────────────┐
│  ~ 100k events / mois actuellement, retention 180 jours                              │
│  Index sur (received_at, event_name, page_route, component_id)                       │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │ (requêtes massives interdites côté admin)
                                           ▼
┌────────────────────────── Couche d'agrégation pré-calculée ───────────────────────────┐
│                                                                                       │
│  insights_event_daily       (event × jour × env × device)                             │
│  insights_page_daily        (page_route × jour)                                       │
│  insights_component_daily   (component_id × jour × event_name)                        │
│  insights_section_daily     (section_id × page_route × jour)                          │
│  insights_funnel_daily      (jour, étapes view_item / atc / checkout / purchase)      │
│  insights_refresh_run       (orchestration : timestamps, durée, succès/erreur)        │
│                                                                                       │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │  refresh par cron (toggle ON/OFF)
                                           ▼
              ┌────────────────────────────────────────────────────────────┐
              │  Cron Vercel  POST /api/admin/analytics/insights/refresh   │
              │                                                            │
              │  Schedule : */15 * * * *  (configurable via settings)      │
              │                                                            │
              │  Authorization: Bearer ${env.CRON_SECRET}                  │
              │  Lock pessimiste pendant le run                            │
              └────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────── Backend admin (Next.js) ────────────────────────────────┐
│                                                                                       │
│  Services (lib/analytics/insights/*)                                                  │
│   ├─ overview.ts       agrège KPIs + time-series                                     │
│   ├─ events.ts         top events + distribution                                      │
│   ├─ pages.ts          top pages + drill-down                                          │
│   ├─ components.ts     top composants + composants morts                               │
│   ├─ sections.ts       durée moyenne d'attention                                      │
│   ├─ funnel.ts         étapes du tunnel + drop-offs                                    │
│   ├─ refresh.ts        orchestration des refreshs (lock, audit, run history)          │
│   └─ filters.ts        parsing + validation des filtres URL                            │
│                                                                                       │
│  Routes API admin authentifiées, cache HTTP 60 s                                      │
└──────────────────────────────────────────┬───────────────────────────────────────────┘
                                           │ JSON
                                           ▼
┌────────────────────────────── Frontend admin (React) ─────────────────────────────────┐
│                                                                                       │
│  Page /admin/analytics/insights                                                       │
│   ├─ <InsightsShell>          (sous-onglets + filtres globaux)                        │
│   ├─ <OverviewPanel>          (KPIs, time-series, heatmap)                            │
│   ├─ <PagesPanel>             (top + drill-down)                                       │
│   ├─ <ComponentsPanel>        (top + morts)                                            │
│   ├─ <SectionsPanel>          (durée moyenne)                                          │
│   ├─ <FunnelPanel>            (sankey + drop-offs)                                     │
│   └─ <RefreshIndicator>       (dernière MAJ + bouton manuel + toggle)                  │
│                                                                                       │
│  Composants de viz (12 types) — SVG custom, sans lib lourde                           │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Découpage en couches

| Couche             | Responsabilités                                                                          | Modules                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Présentation**   | Composants de viz, layout, filtres, drill-down                                           | `components/admin/analytics/insights/*`                                  |
| **Application**    | Hooks de fetch, gestion état URL ↔ filtres                                               | `hooks/use-insights-*`                                                   |
| **API**            | Validation Zod, parsing filtres, cache HTTP, audit                                       | `app/api/admin/analytics/insights/*`                                     |
| **Domaine**        | Logique d'agrégation (queries), normalisation, time windows                              | `lib/analytics/insights/*`                                                |
| **Infrastructure** | Drizzle queries vers `insights_*`, cache LRU optionnel                                   | `lib/db/queries/insights/*`                                              |
| **Cron**           | Refresh, lock, run history                                                                | `app/api/admin/analytics/insights/refresh/route.ts` + `lib/analytics/insights/refresh.ts` |

## 3. Boucle de refresh

```
[Cron Vercel toutes les 15 min]
    │
    ▼
POST /api/admin/analytics/insights/refresh
Bearer ${env.CRON_SECRET}
    │
    ▼
[refresh.ts.start()]
    │
    ▼
[Acquérir lock pessimiste sur insights_refresh_run]  ← refus si lock actif
    │
    ▼
[Lire le toggle "insights.refresh_enabled"]          ← skip si OFF
    │
    ▼
[Pour chaque table d'agrégation, dans l'ordre :]
    1. Calculer la borne basse (= max(received_at) déjà agrégé)
    2. SELECT … FROM tracking_events_log WHERE received_at >= borne_basse
    3. INSERT … ON CONFLICT (date, dim) DO UPDATE
    4. Log durée + count
    │
    ▼
[Insert résultat dans insights_refresh_run]
   + audit log "insights.refresh.success" ou ".failed"
    │
    ▼
[Relâcher le lock]
    │
    ▼
Réponse 200 { ok, durations, counts, lastRunId }
```

### 3.1 Lock pessimiste

Verrou applicatif simple via une ligne `insights_refresh_run` avec
`status = 'running'`. Si un nouveau refresh arrive et trouve une
ligne `running` de moins de 5 minutes, il est rejeté (409).

Au-delà de 5 min, le lock est considéré orphelin (cron-Vercel-tué)
et peut être écrasé.

### 3.2 Refresh incrémental

Les agrégations sont **append-only par jour** :

```sql
INSERT INTO insights_event_daily (date, event_name, env, device, count)
SELECT
  date_trunc('day', received_at)::date,
  event_name,
  env,
  device,
  count(*)
FROM tracking_events_log
WHERE received_at >= $borne_basse
GROUP BY 1, 2, 3, 4
ON CONFLICT (date, event_name, env, device) DO UPDATE
  SET count = EXCLUDED.count, refreshed_at = NOW();
```

`borne_basse` = `max(refreshed_at) - INTERVAL '24 hours'` pour
recapturer les events arrivés en retard (network failures,
batches retardés). Plus une cushion de 24h ne pénalise pas la
perf : seules ~ 1 journée de données est re-agrégée par run.

### 3.3 Refresh manuel

Le bouton admin appelle la même route avec un header alternatif
`X-Admin-Refresh: true` (auth iron-session). Pas de lock partagé
avec le cron : ils peuvent coexister mais le 2e attend le 1er
(file d'attente in-process simple).

## 4. Flux d'une lecture admin

```
[Admin ouvre /admin/analytics/insights]
    │
    ▼
[<InsightsShell> hydrate filtres depuis URL]
    │
    ▼
[useInsightsOverview(filters) → SWR fetch /api/admin/analytics/insights/overview?…]
    │
    ▼
[Service overview.ts]
    │ - Parse filters Zod
    │ - SELECT FROM insights_event_daily WHERE date BETWEEN … AND …
    │ - Calcule KPIs (somme, variation période précédente)
    │
    ▼
[NextResponse.json({ kpis, timeseries, heatmap })]  ← Cache-Control: public, max-age=60
    │
    ▼
[Frontend rend les composants de viz]
```

## 5. Stack technique

| Domaine            | Choix                                                              | Justification                                            |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Pré-agrégation     | Tables Drizzle + INSERT … ON CONFLICT                              | Portable, contrôle fin, incrémental possible             |
| Refresh            | Cron Vercel + Bearer secret                                         | Pas d'infra supplémentaire                                |
| Cache              | Cache-Control 60 s + ETag par filtres                                | Suffisant pour MAJ 15 min                                 |
| Charts             | SVG custom (~ 5 composants) + 1 helper hook                         | Pas de recharts (~ 95 kB), bundle < 80 kB                 |
| State filtres      | URL searchParams + hook `useInsightsFilters`                         | Source de vérité unique, partageable par lien             |
| Tests              | Vitest + MSW + jest-axe + Playwright                                  | Cohérent avec stack existante                             |

## 6. Choix structurants

### 6.1 Pré-agrégation > vue matérialisée native

| Aspect                     | Vue matérialisée Postgres | Tables agrégées (notre choix)         |
| -------------------------- | ------------------------- | ------------------------------------- |
| Refresh incrémental         | Difficile                 | Trivial (INSERT ON CONFLICT)          |
| Portabilité (Neon, etc.)   | Limitée                   | Universelle                           |
| Contrôle de la fréquence    | Bind à un trigger / cron Postgres | Cron Vercel applicatif        |
| Diagnostic des échecs       | SQL stack trace difficile | Logs applicatifs lisibles              |
| Évolution du schéma         | Drop + recreate            | Migration Drizzle classique           |

### 6.2 SVG custom > recharts / chart.js

- **Bundle** : recharts 95 kB gzip vs SVG custom < 5 kB
- **Performance** : pas de hydration JSX recursive sur des arrays de 1000 points
- **Cohérence visuelle** : on contrôle 100 % de la palette FemiGlow
- **A11y** : on attache `<title>` et `aria-label` à la racine, pas de DOM verbeux
- **Compromis** : pas d'animations natives, layout manuel — acceptable

### 6.3 Refresh récurrent > temps réel

- **Coût** : 1 cron toutes les 15 min vs websocket persistent par admin
- **Fraîcheur** : 15 min suffit pour le besoin métier (pas de trading)
- **Simplicité** : pas de gestion de connexions, pas de back-pressure

### 6.4 Pas d'accès direct à `tracking_events_log`

Le service est **read-only** sur les tables `insights_*`. Aucun
SQL ad-hoc sur la table source côté admin. Évite de saturer la
base et impose la discipline de la pré-agrégation.

## 7. Sécurité

- Toutes les routes auth `iron-session` + rôle `analytics-viewer`
  ou supérieur
- Cron auth `Bearer ${env.CRON_SECRET}` (existant)
- Audit log entries : `analytics.insights.refresh`, `.export`, `.toggle`
- Pas de PII dans les pré-agrégations (anonymous_id agrégé au plus,
  pas exposé)
- Drill-down s'arrête au niveau composant_id, pas plus fin

## 8. Lecture suivante

- [02 — Couche data](02-data.md) pour les schémas SQL.
- [03 — Backend](03-backend.md) pour les services.
- [07 — Refresh & orchestration](07-refresh-orchestration.md) pour
  le cron et le toggle.
