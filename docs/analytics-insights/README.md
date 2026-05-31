# Analytics Insights — système de suivi approfondi des événements

> *Spécification complète d'un module **Analytics Insights** dans la
> console admin pour comprendre en profondeur le flux d'événements,
> les composants déclencheurs, les pages visitées, les sections où
> les visiteurs s'attardent — sans temps réel, avec actualisation
> récurrente activable.*

---

## 1. Pourquoi

La table `tracking_events_log` stocke déjà tous les événements
visiteurs valides (cf. `docs/tracking/`). Ce qui manque : une
couche d'**agrégation pré-calculée + visualisation premium** pour
extraire des **insights métier** sans saturer la base et sans
exposer la complexité de SQL ad-hoc.

Cas d'usage concrets :

| Question business                                                | Vue cible                                  |
| ---------------------------------------------------------------- | ------------------------------------------ |
| Quelles sont les pages les plus visitées la semaine dernière ?    | Pages — top 10 par `page_view`             |
| Quels composants déclenchent le plus d'actions ?                  | Composants — top 20 par events totaux      |
| Sur quelles sections les visiteurs s'attardent-ils le plus ?      | Sections — durée moyenne d'attention        |
| Comment évolue le tunnel `view_item → purchase` ?                 | Tunnel — Sankey + drop-offs                |
| Quel est l'engagement par jour de la semaine × heure ?            | Heatmap volume                             |
| Quels events sont en hausse / baisse ?                            | Time-series + variations                   |
| Quels composants ne déclenchent jamais d'event (mort) ?           | Composants morts                            |
| Quel est le ratio conversion par traffic source ?                 | Attribution × conversion                   |

## 2. Périmètre

### Dans le scope V1

- Pré-agrégations matérialisées (events, pages, composants, sections, funnel) refreshées par cron — pas de temps réel
- Toggle ON/OFF du refresh dans les settings admin
- Page `/admin/analytics/insights` avec 5 sous-onglets
- 12 visualisations distinctes (cartes, time-series, heatmap, treemap, sankey, top-N tables)
- 7 fenêtres temporelles (today, yesterday, 7d, 30d, 90d, custom, all)
- Filtres : env, device, traffic source, locale, consent state
- Export CSV par vue, PNG par graphe
- Indicateur "Dernière mise à jour"
- Tests Vitest + MSW + Playwright (~ 200 cas)

### Hors scope V1

- Temps réel (websocket / SSE live) — V2
- Prédictif / ML — V3
- Cohort analysis avancé — V2
- Funnel multi-paths — V2
- Custom reports configurables par l'admin — V2
- Export BigQuery / Datastudio — V2
- Drill-down jusqu'au visiteur individuel — V2 (RGPD)

## 3. Sommaire

| #   | Document                                                              | Contenu                                                              |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 00  | [Cahier des charges](00-cahier-des-charges.md)                        | Exigences fonctionnelles, non-fonctionnelles, KPIs, scope, hors-scope |
| 01  | [Architecture](01-architecture.md)                                    | Vue d'ensemble, couches, flux d'agrégation, boucle de refresh         |
| 02  | [Couche data](02-data.md)                                             | Vues matérialisées, indexes, partitionnement, retention                |
| 03  | [Backend](03-backend.md)                                              | Services agrégation, routes API admin, cache, audit                   |
| 04  | [Frontend](04-frontend.md)                                            | Composants, hooks, store, fetchers, pagination                        |
| 05  | [UI / UX & design](05-ui-ux-design.md)                                | Charte console, tokens, layout, états vide/loading/erreur              |
| 06  | [Visualisations](06-visualisations.md)                                | 12 types de charts détaillés, choix de stack, placement                |
| 07  | [Refresh & orchestration](07-refresh-orchestration.md)                | Cron, toggle, dernière MAJ, gestion d'erreurs, locks                  |
| 08  | [Filtres & exports](08-filtres-exports.md)                             | Filtres globaux, exports CSV/PNG, partage URL                         |
| 09  | [Stratégie de tests](09-tests.md)                                     | Vitest unit, MSW intégration, Playwright E2E, ~ 200 scénarios          |
| 10  | [Plan d'action](10-plan-action.md)                                    | Tickets atomiques `INS-001` → `INS-150`, 7 phases                     |
| 11  | [Runbook](11-runbook.md)                                              | Ops courantes : refresh manuel, troubleshoot, ajout d'une vue        |
| 12  | [Sécurité & RGPD](12-securite-rgpd.md)                                | PII, droit à l'oubli, audit log, permissions                          |
| 13  | [**Wizard design**](13-wizard-design.md)                              | **Spécification UI/UX exhaustive : composants, blocks, charts, états, micro-animations, ergonomie** |

### Annexes

- [`annexes/sql-queries.md`](annexes/sql-queries.md) — requêtes SQL des pré-agrégations
- [`annexes/wireframes.md`](annexes/wireframes.md) — wireframes ASCII des 5 sous-onglets
- [`annexes/scenarios-tests.md`](annexes/scenarios-tests.md) — matrice de scénarios de tests
- [`annexes/mocks-fixtures.md`](annexes/mocks-fixtures.md) — fixtures MSW pour les tests

### Documents post-livraison

- [`EXECUTION_LOG.md`](EXECUTION_LOG.md) — log d'exécution V1 / V1.1 / V1.2 / V1.3
- [`ONBOARDING.md`](ONBOARDING.md) — guide pour acquisition / édito (lecture de la console)
- [`AUDIT_RGPD.md`](AUDIT_RGPD.md) — audit RGPD signé (15 sections, conforme V1.2)
- [`LIGHTHOUSE.md`](LIGHTHOUSE.md) — procédure d'audit perf & a11y

## 4. Conventions transverses

### 4.1 Préfixe identifiants Postgres

| Préfixe | Table                              | Usage                                   |
| ------- | ---------------------------------- | --------------------------------------- |
| `iev_`  | `insights_event_daily`             | Agrégation event × jour                 |
| `ipa_`  | `insights_page_daily`              | Agrégation page × jour                  |
| `ico_`  | `insights_component_daily`         | Agrégation composant × jour             |
| `ise_`  | `insights_section_daily`           | Agrégation section × jour               |
| `ifu_`  | `insights_funnel_daily`            | Agrégation funnel × jour                |
| `irf_`  | `insights_refresh_run`             | Historique des runs de refresh          |

> **Décision** : tables agrégées plutôt que vues matérialisées
> Postgres natives. Raison : portabilité, contrôle de la fréquence
> de refresh, possibilité d'incrémental.

### 4.2 Préfixe API

```
/api/admin/analytics/insights/overview       # KPIs globaux
/api/admin/analytics/insights/events         # Time-series + top events
/api/admin/analytics/insights/pages          # Pages
/api/admin/analytics/insights/components     # Composants
/api/admin/analytics/insights/sections       # Sections
/api/admin/analytics/insights/funnel         # Tunnel ecommerce
/api/admin/analytics/insights/refresh        # POST manuel + GET status
/api/admin/analytics/insights/settings       # GET/PATCH toggle ON/OFF
/api/admin/analytics/insights/export         # GET CSV par vue
```

### 4.3 Préfixe de tickets

`INS-XXX` — environ 150 tâches atomiques réparties en 7 phases
(cf. [10-plan-action.md](10-plan-action.md)).

### 4.4 Voix éditoriale

- Tutoiement maison (cohérent avec admin existant)
- Pas d'emoji
- Termes anglais courants tolérés (KPI, time-series, drop-off, funnel)
- Chiffres formatés à la française (`1 234,5`)
- Dates locales Casablanca

## 5. Performance et contraintes

| Contrainte                                                | Cible                                                |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Latence p95 d'une vue agrégée                              | < 250 ms (depuis pré-agrégation, pas de SQL ad-hoc)  |
| Coût mémoire d'une page complète                           | < 8 Mo après hydratation                             |
| Bundle JS analytics-insights (gzip)                        | < 80 kB (charts inclus, mais pas recharts complet)   |
| Refresh des pré-agrégations                                | < 30 secondes pour 30 j de données (~ 100k rows)     |
| Charge SQL pendant un refresh                              | Pas plus de 5 % CPU Postgres pendant 30 s            |
| Verrou pendant refresh                                     | Aucune contention en lecture (refresh CONCURRENTLY)  |
| Limite SQL par vue                                          | LIMIT 1000 hard, pagination si > 1000               |

## 6. État du document

- Version : 1.0
- Date : 2026-05-07
- Statut : à valider avant kick-off
- Dépendances amont : `docs/tracking/`, `docs/admin/`, `tracking_events_log` (existant)
- Dépendances aval : aucune (autonome)
