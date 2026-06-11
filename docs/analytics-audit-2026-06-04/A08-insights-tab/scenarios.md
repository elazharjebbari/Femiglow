# Scénarios A08 — Onglet Insights + refresh des agrégats

Persona : **Karim**, opérateur, ouvre l'onglet « Insights » pour voir les KPI et le funnel agrégés.
Horloge figée `NOW = 2026-06-03T12:00:00Z`. Rappel : les services Insights lisent les tables `insights_*`,
PAS `tracking_events_log` directement.

## Scénario A08-S1 — Insights « tout vide » alors que le trafic existe (reproduction, rouge avant fix)
Contexte: `tracking_events_log` contient 30 j d'events réels (view_item, begin_checkout, add_payment_info,
purchase, generate_lead), mais le pipeline `runInsightsRefresh` n'a jamais tourné en prod.
Étant donné un `memoryStore` dont `trackingEventsLog` est semé avec `prod_realistic` et dont les tables
`insights_*` sont vides
Quand Karim ouvre « Insights » (appel `getOverview` puis `getFunnel`)
Alors l'overview affiche `firstRun: true` et tous les KPI à 0
Et le funnel affiche 5 étapes toutes à 0
Et Karim croit qu'il n'y a aucun trafic, alors qu'il y en a — les agrégats ne sont juste pas calculés.

## Scénario A08-S2 — Un refresh ressuscite l'onglet (spécification, vert après fix)
Contexte: on lance le pipeline.
Étant donné le même `memoryStore` semé avec `prod_realistic`
Quand `runInsightsRefresh({trigger:'manual', actorId:'adm_1'})` est exécuté puis `getOverview`/`getFunnel`
Alors l'overview renvoie `firstRun:false`, `kpis.totalEvents > 0`, `refreshedAt != null`
Et le funnel renvoie `view_item`, `begin_checkout`, `add_payment_info`, `purchase` non nuls et cohérents
Et Karim voit enfin ses chiffres.

## Scénario A08-S3 — Le toggle OFF étrangle le pipeline (edge, cause prod plausible)
Contexte: le refresh automatique est désactivé.
Étant donné `setInsightsRefreshEnabled(false)` et un `memoryStore` plein d'events
Quand le cron déclenche `runInsightsRefresh({trigger:'cron'})` sans `force`
Alors le run est `skipped` (reason `disabled`) et aucune table `insights_*` n'est alimentée
Et l'onglet reste vide indéfiniment
Et [SPEC] `getInsightsRefreshStatus().enabled === false` permet à l'UI d'afficher « rafraîchissement
désactivé » plutôt que « aucune donnée ».

## Scénario A08-S4 — Confusion firstRun vs vrai vide (edge, diagnostic)
Contexte: deux situations donnent le même écran vide.
Étant donné (a) un store jamais rafraîchi avec du trafic, et (b) un store rafraîchi mais sans aucun event
sur la période
Quand `getOverview` est appelé dans les deux cas
Alors les deux renvoient `firstRun:true` (a cause de `events.length===0 && pages.length===0`) et un écran
identique
Et [SPEC après-fix] l'UI s'appuie sur `getInsightsRefreshStatus().lastRun` : `null` ⇒ « jamais
rafraîchi » (état a), non-null avec `counts.event=0` ⇒ « rafraîchi, pas de donnée » (état b).

## Scénario A08-S5 — Taxonomie funnel : add_payment vs add_payment_info (edge, AN-05/AN-06)
Contexte: le funnel insights compte `add_payment_info` (réel, 18 en base), pas `add_payment`.
Étant donné un store semé uniquement avec des `add_payment` (sans `add_payment_info`) puis rafraîchi
Quand `getFunnel` est appelé
Alors l'étape `add_payment_info` reste à 0 (`add_payment` est hors `FUNNEL_EVENT_NAMES`)
Et [note] `generate_lead` (17) est agrégé mais n'apparaît pas dans les 5 étapes affichées ⇒ conversion
COD sous-représentée (renvoi AN-06).
