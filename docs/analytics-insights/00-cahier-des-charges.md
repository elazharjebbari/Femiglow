# 00 — Cahier des charges

> *Exigences fonctionnelles, non-fonctionnelles, KPIs, scope, hors-scope*

---

## 1. Vision

> *Comprendre ce qui se passe sur la plateforme — pas en spectateur,
> en analyste. Voir les pages qui font respirer, les composants qui
> font cliquer, les sections qui retiennent.*

Pas une dashboard de vanity metrics. Un outil de **lecture de la
plateforme** pour la maison.

## 2. Exigences fonctionnelles

| ID    | Exigence                                                                                                                | Priorité |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| F-01  | Vue d'ensemble (overview) avec 6 KPIs principaux + variation vs période précédente                                       | P0       |
| F-02  | Time-series volume d'événements par jour (granularité hour/day/week)                                                     | P0       |
| F-03  | Top 20 événements (volume, conversion rate)                                                                              | P0       |
| F-04  | Top 30 pages (visites uniques, engagement, conversion)                                                                   | P0       |
| F-05  | Top 50 composants (déclenchement par event)                                                                               | P0       |
| F-06  | Sections : durée moyenne d'attention par section (`fg_section_view` + dérivation)                                       | P0       |
| F-07  | Funnel ecommerce : view_item → add_to_cart → begin_checkout → purchase, avec drop-offs                                  | P0       |
| F-08  | Heatmap heures × jours du volume d'événements                                                                            | P1       |
| F-09  | Distribution par device (mobile/desktop/tablet)                                                                          | P1       |
| F-10  | Distribution par traffic source (utm_source / referrer)                                                                  | P1       |
| F-11  | Filtre période (today / yesterday / 7d / 30d / 90d / custom / all)                                                       | P0       |
| F-12  | Filtre environnement (production / stage / preview / dev)                                                                | P1       |
| F-13  | Filtre device, locale, traffic source, consent state                                                                     | P1       |
| F-14  | Composants morts : liste des composants jamais déclencheurs sur la fenêtre                                                | P1       |
| F-15  | Évolution temporelle d'un composant / page sélectionné                                                                  | P1       |
| F-16  | Refresh manuel via bouton (audit log)                                                                                    | P0       |
| F-17  | Toggle ON/OFF du cron de refresh récurrent                                                                                | P0       |
| F-18  | Indicateur "Dernière mise à jour" + état du dernier run (success/failed)                                                  | P0       |
| F-19  | Export CSV par vue (1 click)                                                                                              | P1       |
| F-20  | Export PNG d'un graphe                                                                                                    | P2       |
| F-21  | Partage par URL (filtres encodés)                                                                                         | P1       |
| F-22  | Empty states éditoriaux (pas de données → message maison)                                                                | P1       |
| F-23  | Drill-down : clic sur un event → liste des composants qui le déclenchent                                                | P1       |
| F-24  | Drill-down : clic sur une page → liste des events sur cette page                                                          | P1       |
| F-25  | Comparaison période → période (par exemple 7j vs 7j précédents)                                                          | P2       |

## 3. Exigences non fonctionnelles

| Exigence                       | Cible                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| Latence p95 (cache hit)        | < 100 ms                                                             |
| Latence p95 (cache miss)       | < 250 ms (depuis tables pré-agrégées)                                |
| Latence cold start cron refresh | < 30 secondes pour 30 j × 100k events                              |
| Bundle JS                      | < 80 kB gzip (charts inclus)                                          |
| Charge Postgres                | < 5 % CPU pendant un refresh                                          |
| Concurrence refresh            | Lock pessimiste (un seul refresh à la fois)                           |
| Disponibilité                  | 99 % (dépend de Vercel + Neon)                                        |
| Maintenabilité                 | Convention de nommage stricte ; 1 vue = 1 service = 1 route + 1 page  |
| Évolutivité                    | Ajout d'une nouvelle vue agrégée en < 1 jour                          |
| Auditabilité                   | Tout refresh + export = entrée audit log                              |
| Accessibilité                  | WCAG 2.2 AA, navigation clavier complète                              |
| RGPD                           | Pas de PII non hashé dans les pré-agrégations                         |

## 4. Acteurs

| Rôle               | Cas d'usage                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| Tech Lead          | Diagnostic perf, debug events manquants                                           |
| Acquisition        | Lecture quotidienne des KPIs, attribution                                         |
| Édito / Marque     | Quels articles du Journal sont lus jusqu'au bout ?                                |
| Product            | Quels composants de la page kit sont sous-utilisés ?                              |
| Data analyst       | Export CSV pour analyses ad-hoc                                                   |

## 5. KPIs de réussite (à mesurer après lancement)

| KPI                                                                              | Cible 90 j |
| -------------------------------------------------------------------------------- | ---------- |
| Latence p95 d'une vue                                                             | ≤ 250 ms   |
| Pages vues du module insights / mois                                              | ≥ 50       |
| Refreshs réussis / refreshs lancés                                                | ≥ 99 %     |
| Lighthouse perf sur la page                                                        | ≥ 90       |
| Couverture tests Vitest                                                           | ≥ 85 %     |
| 0 incident bloquant lié au cron refresh                                            | 100 %      |

## 6. Scope V1 — détaillé

### Inclus

- Page `/admin/analytics/insights` avec :
  - Sous-onglet **Overview** (KPIs, time-series, heatmap)
  - Sous-onglet **Pages** (top + drill-down)
  - Sous-onglet **Composants** (top + morts + drill-down)
  - Sous-onglet **Sections** (durée moyenne, top engagement)
  - Sous-onglet **Funnel** (sankey + drop-offs)
- 5 tables agrégées (events_daily, page_daily, component_daily, section_daily, funnel_daily)
- 1 table d'orchestration (`insights_refresh_run`)
- 9 routes API (cf. README §4.2)
- Cron Vercel `*/15 * * * *` (configurable)
- 12 composants de viz (charts SVG custom, sans lib lourde)
- Filtres + exports + drill-down

### Exclus V1

- Temps réel
- Prédictif
- Cohort analysis
- Multi-tenant
- Comparaison de cohortes (page A vs page B)
- Annotation des graphes (releases, campagnes)
- Webhook export
- API publique externe

## 7. Risques majeurs

| Risque                                                          | Sévérité | Mitigation                                                       |
| --------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| Refresh trop coûteux qui sature Neon                            | Élevée   | Refresh CONCURRENTLY, lock pessimiste, indexes appropriés         |
| Croissance de `tracking_events_log` rend les requêtes lentes    | Moyenne  | Pré-agrégations remplacent les SQL ad-hoc, retention 180 j déjà actif |
| Données stales > 15 min trompent l'admin                         | Moyenne  | Indicateur "Dernière mise à jour" visible en permanence           |
| Bundle JS qui grossit avec les charts                            | Moyenne  | Charts SVG custom plutôt que recharts/chart.js                    |
| Désynchro entre filtres URL et état UI                           | Faible   | Source de vérité = URL, hooks `useFilters()` synchronisés         |
| Refresh concurrent (deux clics rapides) duplique le travail      | Faible   | Lock pessimiste sur `insights_refresh_run`                        |
| Drill-down expose un volume PII                                  | Élevée   | PII jamais dans les agrégations ; drill-down s'arrête au composant_id |
| Nouvelle vue ajoutée → tests cassés                              | Faible   | Convention "1 vue = 1 service + 1 route + 1 fichier de tests"    |

## 8. Critères d'acceptation V1

1. La page `/admin/analytics/insights` charge en < 800 ms TTI.
2. Les 5 sous-onglets sont navigables au clavier.
3. Les 12 visualisations rendent sans erreur sur les 7 fenêtres temporelles.
4. Le refresh manuel termine en < 30 s sur 30 jours de données.
5. Le toggle ON/OFF désactive le cron Vercel sans déploiement.
6. Tous les exports CSV ouvrent dans Excel/Numbers sans corruption d'encoding (UTF-8 BOM).
7. Tests Vitest + MSW : ≥ 200 cas verts.
8. Tests Playwright : 15 specs E2E vertes.
9. Lighthouse `/admin/analytics/insights` : perf ≥ 90, a11y ≥ 95.
10. Audit RGPD : aucune PII non hashée dans `insights_*` tables.
11. Runbook testé : un nouvel admin peut diagnostiquer un refresh failed en < 10 min.

## 9. Lecture suivante

- [01 — Architecture](01-architecture.md) pour la vue d'ensemble.
- [02 — Couche data](02-data.md) pour les schémas SQL.
- [10 — Plan d'action](10-plan-action.md) pour la séquence d'exécution.
