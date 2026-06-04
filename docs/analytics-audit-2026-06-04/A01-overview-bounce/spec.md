# A01 — Vue d'ensemble · Taux de rebond (bounceRate) + filtre de consentement

## Rôle & surface
Onglet « Vue d'ensemble » de `/admin/analytics`. KPI **Taux de rebond** (carte du `OverviewKpiGrid`),
calculé côté serveur par `bounceRate()` dans `apps/web/src/lib/analytics/queries/overview.ts`
(L261-271), exposé via `getOverviewData()` → `kpis.bounceRate`. Vue par l'opérateur (« Karim ») qui
décide d'investir ou non en acquisition selon la qualité du trafic.

Couvre **AN-01** (rebond toujours nul) et **AN-07** (overview sans filtre consentement). Le KPI
`avgSessionDuration` et la série temporelle (`pageViews`) partagent la même racine `page_view`=0 et sont
mentionnés comme dégâts collatéraux.

## Fonctionnement optimal (ce qui DOIT se passer)
- Le **taux de rebond** = part des sessions n'ayant vu qu'une seule page. Sur la fixture prod
  (view_item=339, begin_checkout=97, … aucun `page_view`), l'opérateur doit voir une valeur **non nulle
  et plausible** (ex. 0,40-0,75 pour un mono-produit /kit), pas `—`/0 systématique.
- La métrique doit reposer sur une **notion de « page vue »** réellement émise par l'app. Aujourd'hui
  l'app émet `view_item` à l'arrivée sur /kit (et ses sections), jamais un `page_view` générique : la
  « page vue » de référence doit donc être dérivée d'un événement réel + `page_route`.
- Le KPI doit être calculé sur le **même périmètre de consentement** que les onglets Funnel/CTA/Checkout
  (`consent_snapshot->>'analytics_storage' = 'granted'`), pour que les chiffres soient comparables entre
  onglets. Aujourd'hui overview lit TOUT (granted + denied), les autres filtrent.
- Affichage : ratio formaté en pourcentage FR (ex. « 52 % »), terracotta `#C28A6E` réservé à l'économie
  (pas ici), comparaison vs période précédente avec flèche delta. État « pas de donnée » distinct de
  « rebond = 0 % » (un tiret `—`, pas un faux 0).

## Contrat I/O
- Entrée : `AnalyticsFilters { period, device, traffic, from?, to? }` + `now` (horloge injectable).
- Sortie : `OverviewData.kpis.bounceRate : OverviewKpi { current, previous, delta }`.
  `current`/`previous` ∈ [0,1] ou `null` (aucune session « page »).
- Source : `fetchEvents()` (DB Drizzle si `DATABASE_URL`, sinon `memoryStore`). En DB la requête overview
  **n'ajoute PAS** `consent_snapshot->>'analytics_storage'='granted'` (≠ checkout.ts L453).
- Dépendances internes : `bounceRate(ctx)` (L261), `countPageViews()` (L240), `avgSessionDuration()`
  (L244), `buildSeries()` (L290) — tous filtrent `eventName === 'page_view'`.

## Cas limites & non-happy-path
- **Dataset prod réaliste** (aucun `page_view`) → `sessionPageViews.size === 0` → `bounceRate` renvoie
  `null` (L267). C'est le bug observé : « toujours nul ».
- **Dataset mixte** (view_item + un seul `page_view` injecté) → ne compte QUE le `page_view`, ignore les
  339 view_item → bounce calculé sur 1 session, non représentatif.
- **Consentement** : sessions `analytics_storage='denied'` présentes en base → comptées par overview
  (sessions/visitors gonflés) alors qu'exclues ailleurs → incohérence inter-onglets (AN-07).
- **Frontière** : 1 seule session avec 1 seul event → bounce=1 (100 %) si la source était reconnue ;
  aujourd'hui `null`.
- **Comparaison période** : `previous` aussi `null` → `delta` reste `null` (pas de division par 0).

## Invariants couverts
- **INV-OVERVIEW-BOUNCE** : le rebond reflète des pages réellement vues (événement émis), jamais un 0/null
  structurel dû à un nom d'événement absent.
- **INV-CONSENT-COHERENCE (AN-07)** : tous les onglets calculent sur le même périmètre de consentement.
- Lacune d'audit adressée : désalignement taxonomie émise (`view_item`) vs attendue (`page_view`).

## Critères d'acceptation (observables)
- [REPRO] Sur fixture prod (0 `page_view`), `getOverviewData(...).kpis.bounceRate.current === null` → prouve
  le « toujours nul ».
- [REPRO] Sur fixture mixte (granted + denied), `kpis.sessions.current` d'overview > celui calculé avec le
  filtre consent → prouve AN-07.
- [SPEC] Après fix, sur fixture prod, `bounceRate.current` est un nombre ∈ (0,1) cohérent (sessions à 1
  page vue / sessions « page »), calculé à partir de `view_item`+`page_route`.
- [SPEC] Après fix, overview et checkout renvoient le **même** nombre de sessions sur un dataset contenant
  des events `denied` (périmètre consent aligné).

## Points à vérifier — tous points de vue
- **Backend** : choisir la source de « page vue » (émettre `page_view` à chaque navigation OU élargir
  `bounceRate`/`countPageViews`/`buildSeries` à reconnaître `view_item`+autres events de page) ; ajouter
  le filtre `analytics_storage='granted'` dans `fetchEvents` (overview.ts L158-168 + branche memoryStore
  L184-194).
- **Frontend** : `OverviewKpiGrid` doit distinguer `null` (« — pas de donnée ») de `0` (« 0 % de
  rebond »).
- **UI/UX/design** : format FR « 52 % », pas d'emoji ni `!`, terracotta réservé économie.
- **Data** : décider de la définition métier du rebond pour un funnel mono-page /kit (rebond = session
  view_item unique sans interaction de progression ?).
- **A11y** : la carte KPI annonce la valeur et le delta (aria-label), état vide non ambigu.
- **i18n** : libellé FR/AR du KPI et de l'état vide.
