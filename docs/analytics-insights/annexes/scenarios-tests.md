# Annexe — Matrice de scénarios de tests

> *Détail des scénarios par composant, avec inputs / outputs attendus*

---

## 1. Services backend

### 1.1 `resolveWindow(filters)` — 15 cas

| # | Input                                                | Output attendu                                |
| - | ---------------------------------------------------- | --------------------------------------------- |
| 1 | `{ window: 'today' }`                                | `from = today 00:00`, `to = today 23:59`      |
| 2 | `{ window: 'yesterday' }`                            | `from = yesterday 00:00`, `to = yesterday 23:59` |
| 3 | `{ window: '7d' }`                                   | `from = today-7 00:00`, `to = today 23:59`    |
| 4 | `{ window: '30d' }`                                  | `from = today-30 00:00`, `to = today 23:59`   |
| 5 | `{ window: '90d' }`                                  | `from = today-90 00:00`, `to = today 23:59`   |
| 6 | `{ window: 'all' }`                                  | `from = 2024-01-01`, `to = today 23:59`       |
| 7 | `{ window: 'custom', customFrom: '2026-01-01', customTo: '2026-03-31' }` | OK         |
| 8 | `{ window: 'custom', customFrom: undefined }`         | throw `invalid_input`                         |
| 9 | `{ window: 'custom', customFrom: '2025-01-01', customTo: '2026-12-31' }` | throw (> 365j)  |
| 10 | `{ window: 'custom', customFrom: '2026-12-01', customTo: '2026-01-01' }` | throw (inverse) |
| 11 | `{ window: 'custom', customFrom: 'invalid' }`         | throw                                          |
| 12 | DST transition (mars / octobre)                       | dates correctes en local TZ Casablanca         |
| 13 | Year boundary (`2025-12-30` à `2026-01-05`)            | OK                                              |
| 14 | Mois 31 jours / 28 jours / 30 jours                  | OK toutes les variantes                         |
| 15 | Timezone Casablanca strict (UTC offset)              | dates pivotent à minuit locales                |

### 1.2 `overviewService.get` — 12 cas

| # | Setup                                                 | Attendu                                         |
| - | ----------------------------------------------------- | ----------------------------------------------- |
| 1 | tables vides                                           | `{ kpis: { totalEvents: 0, ... }, firstRun: true }` |
| 2 | 1 jour de données simples                             | `totalEvents = 1`, variation = 0                  |
| 3 | 30 jours de données                                    | KPIs cohérents                                    |
| 4 | Comparaison 7j vs 7j précédents                       | variation correcte                                |
| 5 | Filtre env=production                                  | exclut staging                                    |
| 6 | Filtre device=mobile                                   | exclut desktop                                    |
| 7 | Filtre locale=fr-MA                                    | exclut autres                                     |
| 8 | Conversion ratio                                       | conversions/totalEvents correctement             |
| 9 | Window=all sur > 365j                                  | borne à 365j + warning                            |
| 10 | Date sans données au milieu                          | timeseries point à 0                              |
| 11 | Bounce rate calculé correctement                       | sessions à 1 PV / total sessions                  |
| 12 | Heatmap couvre 168 cells (7×24)                       | toutes présentes                                  |

### 1.3 `pagesService.top` — 10 cas

| # | Setup                                | Attendu                                              |
| - | ------------------------------------ | ---------------------------------------------------- |
| 1 | tables vides                          | `[]`                                                  |
| 2 | 5 pages                               | trié par PV desc                                      |
| 3 | LIMIT 30 respecté                     | tronqué à 30                                          |
| 4 | Engagement scroll_75 calculé         | scroll_75 / page_views correct                        |
| 5 | Filtre env=production                 | exclut staging                                        |
| 6 | Page sans events                      | exclue                                                |
| 7 | Routes avec QS différents             | groupées sur page_route canonique                     |
| 8 | Bounce rate calculé                   | bounce_count / sessions correct                       |
| 9 | Drill-down sur page valide           | events liés                                           |
| 10 | Drill-down sur page inexistante       | 404                                                    |

### 1.4 `componentsService.dead` — 5 cas

| # | Setup                                                | Attendu                                |
| - | ---------------------------------------------------- | -------------------------------------- |
| 1 | 3 composants tous actifs                              | `[]`                                    |
| 2 | 1 composant sans events sur 30j                      | `[component]`                           |
| 3 | Composant archivé                                     | exclu                                   |
| 4 | Composant actif mais 0 events sur fenêtre custom     | inclus                                   |
| 5 | Sur fenêtre 1j sans events                            | tous composants morts                   |

### 1.5 `funnelService.daily` — 10 cas

| # | Setup                                                  | Attendu                                |
| - | ------------------------------------------------------ | -------------------------------------- |
| 1 | Tunnel complet 100 / 50 / 25 / 20 / 15                  | 5 étapes + drop-offs corrects           |
| 2 | Pas de view_item                                         | étape vide, suite 0                     |
| 3 | view_item sans add_to_cart                                | drop-off 100 %                          |
| 4 | Tunnel sur 1 seul jour                                  | OK                                      |
| 5 | Tunnel sur 30 jours                                     | sum cohérent                            |
| 6 | Revenue total non zéro                                   | sum payload.value                       |
| 7 | unique_purchasers ≤ purchase                             | invariant                               |
| 8 | Période vide                                              | tous zéros                              |
| 9 | Conversion inter-étape ∈ [0, 1]                          | invariant                               |
| 10 | Drop-off ≤ 0                                              | invariant                               |

### 1.6 `refresh.run` — 18 cas

| # | Setup                                                     | Attendu                                       |
| - | --------------------------------------------------------- | --------------------------------------------- |
| 1 | tables source vides                                        | success, counts à 0                            |
| 2 | 100 events                                                 | success, counts non zéro                       |
| 3 | Lock déjà détenu < 5 min                                   | 409 `refresh_in_progress`                      |
| 4 | Lock orphelin > 5 min                                      | écrasé, run réussi                            |
| 5 | Toggle OFF                                                  | skipped                                       |
| 6 | Toggle ON                                                   | run normal                                    |
| 7 | Erreur SQL sur étape 3                                     | failed, lock libéré, audit log                  |
| 8 | Idempotence (run × 2 même fenêtre)                          | seconds run = MAJ sans dup                     |
| 9 | Backfill initial (table vide)                                | 90j en arrière                                 |
| 10 | Backfill incrémental (table existante)                       | borne basse 24h cushion                        |
| 11 | Cron auth Bearer absent                                       | 401                                            |
| 12 | Cron auth Bearer invalide                                     | 403                                            |
| 13 | Refresh manuel admin                                          | accepté avec session                           |
| 14 | Refresh manuel sans session                                   | 401                                            |
| 15 | Performance 30j × 100k rows                                    | < 30 s                                         |
| 16 | Audit log entry présente                                       | toujours                                       |
| 17 | counts cohérents avec rowCount                                  | invariant                                      |
| 18 | durations × 5 étapes présents                                  | invariant                                      |

## 2. Composants frontend

### 2.1 `<KpiCard>` — 6 cas

| # | Props                                            | Attendu                                |
| - | ------------------------------------------------ | -------------------------------------- |
| 1 | `value=12437, variation=0.14, label="Events"`    | "12 437" + "↗ +14 %" en sauge          |
| 2 | `variation=-0.05`                                | "-5 %" en pétale rouge                 |
| 3 | `variation=0`                                     | "0 %" neutre                           |
| 4 | `prefers-reduced-motion: reduce`                  | pas de count-up                        |
| 5 | `variation=undefined`                              | pas de bloc variation                  |
| 6 | a11y axe                                          | 0 violations                            |

### 2.2 `<EventsTimeSeries>` — 6 cas

| # | Props                                  | Attendu                                |
| - | -------------------------------------- | -------------------------------------- |
| 1 | data vide                               | `<EmptyState>`                          |
| 2 | 1 point                                 | render sans crash, no path              |
| 3 | 30 points                                | path SVG avec 30 segments               |
| 4 | 60 points                                | path SVG avec 60 segments               |
| 5 | hover sur un point (V2)                  | tooltip                                  |
| 6 | a11y `<title>` + `aria-label`            | présent                                  |

### 2.3 `<ActivityHeatmap>` — 5 cas

| # | Setup                                    | Attendu                                |
| - | ---------------------------------------- | -------------------------------------- |
| 1 | 168 cells (7×24)                         | tous rendus                             |
| 2 | cells vide                                | opacité min                             |
| 3 | 1 cell max                                | opacité 1.0                             |
| 4 | tooltip natif sur cell                    | "Lun 14h : 327 events"                   |
| 5 | a11y axe                                  | 0 violations                            |

### 2.4 `<FunnelSankey>` — 5 cas

| # | Setup                                    | Attendu                                |
| - | ---------------------------------------- | -------------------------------------- |
| 1 | 5 étapes complètes                       | 5 bandes proportionnelles                |
| 2 | 1 seule étape                             | 1 bande, autres à 0                     |
| 3 | Drop-offs visibles                        | bandes décroissantes                     |
| 4 | data vide                                  | empty state                              |
| 5 | a11y `<title>` par bande                   | présent                                  |

### 2.5 `<InsightsRefreshIndicator>` — 6 cas

| # | État `lastRun`                          | Affichage attendu                                |
| - | --------------------------------------- | ------------------------------------------------ |
| 1 | `null`                                  | "Aucun refresh"                                  |
| 2 | `{ status: 'running' }`                 | "Calcul en cours…" + spinner                       |
| 3 | `{ status: 'success', finishedAt: -7m }` | "il y a 7 min"                                   |
| 4 | `{ status: 'failed', errorMessage: '…' }` | bannière rouge + détails                         |
| 5 | toggle OFF                                | "Désactivé · Manuel uniquement"                   |
| 6 | clic bouton "Refresh maintenant"           | POST /refresh + toast succès                       |

## 3. Hooks

### 3.1 `useInsightsFilters` — 12 cas

| # | URL                                               | filtres parsés / set                            |
| - | ------------------------------------------------- | ----------------------------------------------- |
| 1 | `/admin/analytics/insights`                        | `{ window: '7d', env: 'all', ... }`              |
| 2 | `?window=30d`                                      | `window: '30d'`                                  |
| 3 | `?window=custom&customFrom=2026-01-01&customTo=…` | custom range                                      |
| 4 | `?env=production`                                  | env filter                                       |
| 5 | `?device=mobile`                                   | device filter                                    |
| 6 | `set({ window: '30d' })`                            | URL = `?window=30d`                              |
| 7 | `set({ env: 'all' })`                                | URL retire env (default)                          |
| 8 | `set({ env: 'production' })`                         | URL ajoute `?env=production`                     |
| 9 | reset → tous defaults                                | URL = `/admin/analytics/insights`                 |
| 10 | window invalide via URL                              | fallback default                                  |
| 11 | URL avec params extras                               | params extras conservés                           |
| 12 | navigation arrière                                    | filtres restaurés                                  |

## 4. Routes API (intégration MSW)

### 4.1 `GET /overview` — 8 cas

| # | Setup                                        | Attendu                            |
| - | -------------------------------------------- | ---------------------------------- |
| 1 | session absente                               | 401                                 |
| 2 | session valide                                | 200 + payload                       |
| 3 | tables vides                                   | `firstRun: true`                    |
| 4 | filtre env=production                          | exclut autres                        |
| 5 | filtre invalide                                | 422                                 |
| 6 | window > 365j                                  | 422 ou borné                         |
| 7 | Cache-Control `private, max-age=60`            | présent                              |
| 8 | header X-Insights-Refreshed-At                 | présent                              |

### 4.2 `POST /refresh` — 12 cas

| # | Setup                                          | Attendu                            |
| - | ---------------------------------------------- | ---------------------------------- |
| 1 | Bearer cron valide                              | 200 + counts                        |
| 2 | Bearer cron invalide                              | 403                                 |
| 3 | Bearer absent                                     | 401                                 |
| 4 | Session admin                                     | 200 (manual)                        |
| 5 | Session sans rôle                                  | 403                                 |
| 6 | Lock détenu                                        | 409                                 |
| 7 | Toggle OFF + cron                                  | 200 `{ skipped: true }`              |
| 8 | Toggle OFF + manual                                | 200 normal                          |
| 9 | Erreur SQL                                          | 500 + audit log                      |
| 10 | Idempotence                                          | 200 sans dup                        |
| 11 | Audit log appelé                                      | toujours                             |
| 12 | Run history persisté                                  | toujours                             |

### 4.3 `GET /export?view=pages` — 8 cas

| # | Setup                                        | Attendu                                          |
| - | -------------------------------------------- | ------------------------------------------------ |
| 1 | view valide                                   | 200 + Content-Disposition                         |
| 2 | view invalide                                  | 422                                               |
| 3 | BOM UTF-8 présent                              | premier byte = `﻿`                            |
| 4 | rows > 100k                                    | 422 `export_too_large`                            |
| 5 | filtre env=production                          | CSV filtré                                         |
| 6 | filename auto-daté                              | `insights-pages-2026-05-07.csv`                    |
| 7 | audit log entry                                  | présent                                            |
| 8 | session sans permission export                   | 403                                               |

## 5. Tests E2E Playwright (15 specs)

### 5.1 Liste

| # | Spec                                                  | Étapes                                               |
| - | ----------------------------------------------------- | ---------------------------------------------------- |
| 1 | page protégée                                          | sans cookie → redirect /login                         |
| 2 | 5 sous-onglets visibles                                 | login → page → 5 onglets visibles                     |
| 3 | filtre 7d → 30d met à jour                              | clic select → URL change → KPIs change                  |
| 4 | filtre custom range invalide                             | from > to → erreur visible                              |
| 5 | refresh manuel                                            | bouton → "à l'instant"                                  |
| 6 | toggle OFF                                                 | bouton → "Désactivé"                                    |
| 7 | drill-down page                                            | clic ligne → drawer ouvert                                |
| 8 | drill-down composant                                       | idem                                                       |
| 9 | composants morts                                            | render correct + lien archive                              |
| 10 | funnel 5 étapes                                            | sankey + table visibles                                    |
| 11 | heatmap a11y                                                | tab dans cells, tooltip natif                              |
| 12 | export CSV download                                          | bouton → fichier dl + filename + BOM                       |
| 13 | window=all > 365j                                            | warning visible                                            |
| 14 | first run state                                              | tables vides → "Premier calcul…"                            |
| 15 | lighthouse perf ≥ 90                                          | audit                                                       |

## 6. Property-based tests

### 6.1 `linearScale`

```ts
fc.assert(
  fc.property(fc.tuple(fc.float(), fc.float()), fc.tuple(fc.float(), fc.float()), fc.float(),
    ([d0, d1], [r0, r1], v) => {
      const scale = linearScale([d0, d1], [r0, r1]);
      if (d0 === d1) return true; // edge
      const result = scale(v);
      // Monotone : si v augmente, result augmente (ou diminue selon sens)
      return Number.isFinite(result);
    }),
);
```

### 6.2 `computeDropoff`

```ts
fc.assert(
  fc.property(fc.nat(), fc.nat(),
    (a, b) => {
      const result = computeDropoff(a, b);
      return result.dropoff <= 0 && result.conversion >= 0 && result.conversion <= 1;
    }),
);
```

## 7. Tests de performance

| Test                                  | Cible    | Implémentation                                |
| ------------------------------------- | -------- | --------------------------------------------- |
| `overview` 10k events                 | < 50 ms  | benchmark via `performance.now()`              |
| `refreshEventDaily` 100k rows         | < 8 s    | benchmark via `performance.now()`              |
| `EventsTimeSeries` render 60 points   | < 30 ms  | render time via Profiler                        |
| `ActivityHeatmap` render 168 cells    | < 20 ms  | idem                                           |
| Bundle gzip                            | < 80 kB  | webpack-bundle-analyzer                         |
| Lighthouse perf                        | ≥ 90     | CI                                              |

## 8. Coverage cible

| Module                                | Cible     |
| ------------------------------------- | --------- |
| `lib/analytics/insights/*`            | ≥ 90 %    |
| `hooks/insights/*`                    | ≥ 85 %    |
| `components/admin/analytics/insights/*` | ≥ 80 %  |
| Routes API                            | ≥ 90 %    |
| Global insights                        | ≥ 85 %    |
