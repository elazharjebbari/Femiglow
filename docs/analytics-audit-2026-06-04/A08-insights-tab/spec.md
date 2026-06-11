# A08 — Onglet Insights (overview/funnel/pages/components/sections) + refresh des agrégats

## Rôle & surface
Onglet « Insights » de `/admin/analytics` (composant `InsightsView`). Les services de lecture
`apps/web/src/lib/analytics/insights/services.ts` lisent **exclusivement** les tables pré-agrégées
`insights_*` (jamais `tracking_events_log`, sauf heatmap). Ces tables sont alimentées par le pipeline
`refresh.ts` → `aggregate.ts`. Vu par l'opérateur (« Karim ») qui consulte les KPI, le funnel et les top
pages/composants.

Couvre **AN-05** : Insights « tout vide » alors que les événements nécessaires
(view_item/begin_checkout/add_payment_info/purchase/generate_lead) EXISTENT en base ⇒ la cause est que
les **agrégats ne sont pas rafraîchis en prod** ; le « firstRun » (tables vides) est confondu avec
« aucun trafic ». Note secondaire : le funnel insights compte `add_payment_info` (et non `add_payment`).

## Fonctionnement optimal (ce qui DOIT se passer)
- Quand `refresh.ts` a tourné, les services renvoient des KPI/funnel non nuls. Sur la fixture prod
  (events présents), un refresh doit produire `insights_event_daily`, `insights_funnel_daily`, etc.
  peuplés ; `getOverview()` renvoie `firstRun: false` et des KPI > 0 ; `getFunnel()` renvoie un funnel
  avec `view_item`, `begin_checkout`, `add_payment_info`, `purchase` non nuls.
- L'UI doit **distinguer trois états** : (a) « pas encore rafraîchi / first run » (tables vides, mais du
  trafic existe en amont), (b) « rafraîchi, aucune donnée sur la période » (vrai zéro), (c) « données
  présentes ». Aujourd'hui `firstRun: events.length===0 && pages.length===0` ne distingue pas (a) de (b),
  et `getOverview` renvoie `emptyOverview()` avec `firstRun:true` aussi bien sur erreur storage que sur
  tables vides ⇒ « tout vide » indiscernable d'un pipeline non lancé.
- Le funnel insights (`getFunnel`, services.ts L577) doit aligner sa taxonomie sur les événements réels :
  il compte `view_item/add_to_cart/begin_checkout/add_payment_info/purchase`. Le nom `add_payment_info`
  est correct (présent en base, 18) ; le risque est de confondre avec `add_payment` (l'onglet Checkout
  accepte les deux, le funnel insights non). `generate_lead` est agrégé par `aggregate.ts` mais **pas
  affiché** dans les 5 étapes de `getFunnel` (cf. AN-06 conversion COD).

## Contrat I/O
- Lecture : `getOverview/getFunnel/getPagesTop/getComponentsTop/getSectionsTop` lisent `insights_*` via
  `fetchEventDaily/fetchFunnelDaily/...` (Drizzle ou memoryStore).
- Écriture : `runInsightsRefresh({trigger, actorId, force?})` → `aggregateEvents()` → upsert dans 5 tables.
  `FUNNEL_EVENT_NAMES` (aggregate.ts L34) = `{view_item, add_to_cart, begin_checkout, add_payment_info,
  purchase, generate_lead}`.
- `getOverview` retourne `OverviewResponse { kpis, variations, timeseries, heatmap, topEvents, refreshedAt,
  firstRun }`. `firstRun:true` si `events.length===0 && pages.length===0` (L102) OU en cas d'erreur
  storage (`emptyOverview()`, L110).
- `getInsightsRefreshStatus()` expose `lastRun`, `lockHeld`, `enabled`, `intervalMinutes` — l'UI peut
  savoir si un refresh a déjà eu lieu.
- Toggle : `runInsightsRefresh` avec `trigger='cron'` et `enabled=false` (sans `force`) ⇒ `skipped` /
  reason `disabled` (le pipeline ne tourne pas du tout).

## Cas limites & non-happy-path
- **Tables insights vides + events présents** (= prod) : `getOverview` → `firstRun:true`, KPI à 0 ;
  `getFunnel` → toutes étapes à 0. C'est le symptôme « Insights tout vide ». Le diagnostic : il faut
  `runInsightsRefresh`.
- **Après refresh** : sur le même `memoryStore`, KPI/funnel non nuls, `firstRun:false`,
  `refreshedAt != null`.
- **Toggle OFF en cron** : aucun agrégat produit → tables restent vides → Insights vide. Le statut doit
  indiquer `enabled:false`.
- **Erreur storage** (tables absentes / migration en retard) : `getOverview` log `degraded` + renvoie
  `emptyOverview()` `firstRun:true` ⇒ indiscernable d'un vrai first run sans log côté UI.
- **Incrémental** : `computeIncrementalSince` recule de 24 h depuis le `max(refreshedAt)` ; si jamais
  rafraîchi → backfill 90 j. Un refresh « réussi mais vide » (`counts.event=0`) sur une base pleine
  d'events anciens (> 90 j ou > cushion) peut laisser des trous.
- **Funnel COD** : `generate_lead` (17) agrégé mais absent des 5 étapes affichées ⇒ conversion
  sous-représentée (lien AN-06).

## Invariants couverts
- **INV-INS-REFRESH** : si du trafic existe en `tracking_events_log`, un refresh produit des agrégats non
  vides ; Insights n'est « vide » que si le pipeline n'a pas tourné (état (a)) ou si aucune donnée sur la
  période (état (b)), et les deux sont distinguables.
- **INV-INS-FUNNEL-NAMES** : le funnel insights compte `add_payment_info` (réel) ; aucun comptage ne
  repose sur `add_payment` (qui n'existe pas en base).
- Lacune adressée : confusion firstRun/matview-vide vs no-traffic ; orchestration refresh prod.

## Critères d'acceptation (observables)
- [REPRO] Sur `memoryStore` contenant les events prod mais SANS refresh, `getOverview().firstRun === true`
  et `kpis.totalEvents === 0` ; `getFunnel().stages.every(s=>s.count===0)`.
- [REPRO] `getFunnel` ne compte jamais `add_payment` : un event `add_payment` seul (sans `add_payment_info`)
  reste à 0 dans `addPaymentInfo` après refresh.
- [REPRO] Cron + toggle OFF ⇒ `runInsightsRefresh` renvoie `skipped:true` reason `disabled`, tables
  inchangées.
- [SPEC] Après `runInsightsRefresh`, `getOverview().firstRun === false`, `kpis.totalEvents > 0`,
  `refreshedAt != null`.
- [SPEC] Après refresh, `getFunnel().stages` : `view_item`/`begin_checkout`/`add_payment_info`/`purchase`
  non nuls et cohérents avec la fixture.
- [SPEC] L'état (a) « jamais rafraîchi » est distinguable de (b) « rafraîchi mais vide » via
  `getInsightsRefreshStatus().lastRun` (null vs non-null).

## Points à vérifier — tous points de vue
- **Backend** : garantir l'exécution du refresh en prod (cron/endpoint), surveiller le toggle `enabled` ;
  dans `getOverview`, distinguer l'erreur storage (`emptyOverview`) du vrai first run (ajouter un drapeau
  d'erreur / utiliser `lastRun` côté UI) ; envisager d'exposer `generate_lead` dans le funnel (AN-06).
- **Frontend** : `InsightsView` doit afficher un état « pré-agrégats non calculés — lancer un refresh »
  (avec `getInsightsRefreshStatus`) plutôt que « aucune donnée », et un bouton refresh manuel.
- **UI/UX/design** : message d'état clair, pas d'emoji ; ne pas faire croire à 0 trafic.
- **Data** : vérifier le cushion incrémental (24 h) et le backfill 90 j vs ancienneté des events ; aligner
  `FUNNEL_EVENT_NAMES` avec la taxonomie réelle (`add_payment_info` ✓).
- **A11y** : état vide annoncé (role=status), bouton refresh accessible.
- **i18n** : libellés FR/AR des trois états et du funnel.
