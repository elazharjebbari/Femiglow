# A09 — Filtres transverses (réactivité · fuseau horaire · device par défaut)

## Rôle & surface
Barre de filtres partagée par tous les onglets analytics (`FilterBar`, hook
`components/admin/analytics/hooks/useAnalyticsFilters.ts`) + résolution des plages dans
`apps/web/src/lib/analytics/filters.ts` (`parseFiltersFromSearchParams`, `resolveRange`, `startOfDay`,
`DEFAULT_FILTERS`). Vu par l'opérateur (« Karim ») qui change période/device/source et attend que tous les
onglets se rafraîchissent de façon cohérente, dans le fuseau Maroc.

Couvre **AN-09** (filtres figés), **AN-10** (fuseau UTC vs Maroc UTC+1), **AN-11** (device par défaut
= mobile au lieu de all).

> ⚠️ **État du code constaté (2026-06-04)** — important pour le triage :
> - **AN-09** : la version actuelle de `useAnalyticsFilters` dérive `filters` de `useSearchParams` via
>   `useMemo`, et `CtaDashboard`/`CheckoutDashboard`/`InsightsView` refetchent sur changement de filtre
>   (`useEffect([filters])`, `router.replace`). Le « `useState(initialFilters)` figé » décrit dans le
>   report 2026-05-30 **n'est plus reproductible sur le chemin partagé** : AN-09 est largement **corrigé**.
>   Les cas A09 pour AN-09 servent donc de **garde-fou de non-régression** (+ couverture de l'edge
>   restant : hydratation localStorage au 1er mount et garde « 1er rendu » anti double-fetch).
> - **AN-10** : `filters.ts` définit déjà `ANALYTICS_TIMEZONE = 'Africa/Casablanca'` et `startOfDay` borne
>   les jours dans ce fuseau via `Intl` (indépendant du `TZ` process). AN-10 est **corrigé** ; les cas
>   servent de non-régression (un purchase à 00:30 Maroc tombe bien « aujourd'hui »).
> - **AN-11** : `DEFAULT_FILTERS.device = 'mobile'` et `AnalyticsFiltersSchema.device.default('mobile')`
>   sont **toujours en place** ⇒ AN-11 **non corrigé**. C'est le seul des trois encore franchement actif.

## Fonctionnement optimal (ce qui DOIT se passer)
- **Réactivité (AN-09)** : changer un filtre met à jour l'URL (`router.replace`), `useAnalyticsFilters`
  relit l'URL et expose les nouveaux `filters`, chaque dashboard refetch l'API correspondante. Aucun
  onglet ne reste figé sur `initialData`.
- **Fuseau (AN-10)** : « Aujourd'hui »/« Hier »/« 7 j » sont bornés à 00:00 **heure Maroc** (UTC+1, pas de
  DST). Un achat à 00:30 heure Maroc (= 23:30 UTC la veille) doit compter dans « Aujourd'hui ».
- **Device par défaut (AN-11)** : en l'absence de paramètre `device`, l'opérateur doit voir **tout** le
  trafic (`all`), pas seulement le `mobile`. Le défaut actuel `mobile` masque silencieusement tablet +
  desktop ⇒ KPI sous-évalués sans avertissement.
- **Parsing robuste** : une clé invalide est ignorée sans invalider la sélection entière (déjà le cas,
  `inEnum`).

## Contrat I/O
- `DEFAULT_FILTERS = { period:'today', device:'mobile', traffic:'all' }` (filters.ts L81-85). ⚠️ AN-11.
- `AnalyticsFiltersSchema` : `device: z.enum(ANALYTICS_DEVICES).default('mobile')` (L41). ⚠️ AN-11.
- `parseFiltersFromSearchParams(params)` → `AnalyticsFilters` ; clé absente ⇒ défaut Zod ; clé invalide ⇒
  ignorée (`inEnum`) ; échec global ⇒ `DEFAULT_FILTERS`.
- `resolveRange(filters, now)` → `{ from, to, comparisonFrom, comparisonTo }` ; bornes via `startOfDay`
  en `ANALYTICS_TIMEZONE` (L155-182, 218-228).
- `filtersToSearchParams(filters)` n'émet `device` que s'il diffère du défaut (`'mobile'`) ⇒ tant que le
  défaut est `mobile`, sélectionner `mobile` produit une URL sans `device` (cohérent mais perpétue AN-11).
- Hook `useAnalyticsFilters` : `filters` (réactif URL), `setFilters` (push URL + localStorage), `reset`.

## Cas limites & non-happy-path
- **URL `?device=` absent** → `device='mobile'` ⇒ KPI ne montrent que le mobile (AN-11, bug observé).
- **URL `?period=foo&device=desktop`** → period invalide ignorée (défaut `today`), `desktop` conservé.
- **`period=custom` sans from/to** → `safeParse` échoue ⇒ `DEFAULT_FILTERS`.
- **`from >= to`** ou **range > 366 j** → refus (superRefine) ⇒ `DEFAULT_FILTERS`.
- **Fuseau** : `now = 2026-06-03T23:30:00Z` (= 2026-06-04 00:30 Maroc) avec `period='today'` → la borne
  `from` est le 2026-06-04 00:00 Maroc ⇒ un event à `2026-06-03T23:30:00Z` est dans « aujourd'hui ».
- **localStorage** : URL vide + filtres stockés < 30 j ⇒ hydratation depuis localStorage et push URL ;
  stocké expiré/corrompu ⇒ ignoré.
- **Premier rendu** : garde `isFirstRun` empêche un double-fetch quand l'URL == `initialFilters`.

## Invariants couverts
- **INV-FLT-REACT (AN-09)** : tout changement de filtre se propage à l'URL et déclenche un refetch ; pas
  d'état figé.
- **INV-FLT-TZ (AN-10)** : les bornes de période sont calculées en fuseau Maroc, indépendamment du `TZ`
  du process.
- **INV-FLT-DEVICE (AN-11)** : le device par défaut couvre tout le trafic (`all`).

## Critères d'acceptation (observables)
- [REPRO AN-11] `parseFiltersFromSearchParams(new URLSearchParams()).device === 'mobile'` →
  prouve le défaut masquant.
- [REPRO AN-11] `getOverviewData`/`getCheckoutData` avec `DEFAULT_FILTERS` sur un dataset mixte
  mobile/desktop ne compte QUE le mobile.
- [SPEC AN-11] Après fix, `parseFiltersFromSearchParams(new URLSearchParams()).device === 'all'` et les
  KPI couvrent tout le trafic.
- [REGRESSION AN-09] Changer `period` via `setFilters` met à jour `filters` (relu depuis l'URL) ; le
  dashboard refetch (`router.replace` appelé, `fetch` déclenché).
- [REGRESSION AN-10] Avec `now=2026-06-03T23:30:00Z` et `period='today'`, `resolveRange().from` correspond
  au 2026-06-04 00:00 Maroc (= 2026-06-03T23:00:00Z) ⇒ l'event à 23:30 UTC est inclus.

## Points à vérifier — tous points de vue
- **Backend/lib** : changer `DEFAULT_FILTERS.device` et le `.default()` du schéma de `'mobile'` → `'all'`
  (AN-11) ; vérifier l'impact sur `filtersToSearchParams` (le défaut omis devient `all`).
- **Frontend** : non-régression de `useAnalyticsFilters` (réactivité AN-09) ; vérifier que le sélecteur
  device de `FilterBar` affiche « Tous » par défaut.
- **UI/UX/design** : indiquer clairement le device actif (badge), éviter de laisser croire « tout » quand
  c'est `mobile`.
- **Data** : recalcul des comparaisons (`comparisonFrom/To`) inchangé par le fuseau ; cohérence des deltas.
- **A11y** : `FilterBar` selects étiquetés, changement annoncé.
- **i18n** : libellés period/device/traffic FR/AR ; « Tous » / « الكل ».
