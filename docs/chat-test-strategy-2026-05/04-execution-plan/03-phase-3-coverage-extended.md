# Phase 3 — Couverture P1 (services + components)

**Durée** : 1 semaine (5 jours)

Compléter la couverture P1 et préparer le terrain pour Phase 4 (E2E).

## Jour 26 — Admin pages secondaires
- F37 admin overview, F38 conversations list, F39 conversation detail
- 24 tests component (CRUD list / filter / search / pagination)

## Jour 27 — Admin pages CRUD avancées
- F45 providers, F46 instructions, F47 FAQ, F48 canned (déjà partiellement en Phase 2 pour F40)
- 30 tests component

## Jour 28 — Admin analytics + audit log
- F42 analytics dashboard, F43 audit log, F44 KPIs
- Vérifier les graph charts (recharts) avec snapshot léger (pas de pixel-diff)

## Jour 29 — Cross-cutting bricks
- F55 webhooks delivery + retry (M3 régression)
- F56 Slack alerts
- F58 multi-provider matrix (sondage par provider — 1 test e2e par provider important)

## Jour 30 — F60 Cron jobs
- F60 cron jobs : intent recompute, KB sync (futur), weekly digest, budget watch
- Tests integration sur les cron functions isolées (sans le scheduler)

**Gate sortie Phase 3** :
- Coverage moyen global ≥ 80 %
- Coverage admin ≥ 70 %
- Coverage cross-cutting ≥ 85 %

## Livrables phase 3

- ~50 nouveaux tests
- README admin features avec captures
- Métriques performance composants admin (RTL `act()` sans warning)
