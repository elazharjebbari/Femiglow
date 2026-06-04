# A02 — Vue d'ensemble · Top pages (topPages)

## Rôle & surface
Onglet « Vue d'ensemble » de `/admin/analytics`, bloc **Top pages** (composant `OverviewTopPages`).
Calculé par `topPages()` dans `apps/web/src/lib/analytics/queries/overview.ts` (L352-369), exposé via
`getOverviewData()` → `topPages: OverviewPageRow[]`. Vu par l'opérateur (« Karim ») qui veut savoir
quelles routes attirent et convertissent.

Couvre **AN-01** (top pages toujours vide).

## Fonctionnement optimal (ce qui DOIT se passer)
- Le tableau « Top pages » liste les routes les plus vues sur la période, triées par `pageViews` desc,
  avec colonnes : `pageRoute`, `pageViews`, `sessions` (cf. `OverviewPageRow`).
- Sur un site mono-produit, `/kit` doit dominer (c'est là qu'arrivent 339 `view_item`). L'opérateur doit
  voir au moins `/kit` avec un volume de vues > 0.
- Le regroupement doit se faire sur une **page réellement vue**. Aujourd'hui `topPages` groupe par
  `e.pageRoute` mais **uniquement** pour les events `eventName === 'page_view'` (L355) ; or `page_view`
  n'est jamais stocké → la `Map byPage` reste vide → tableau vide.
- La source de « vue de page » doit être alignée avec l'émission réelle (`view_item` porte `page_route`).

## Contrat I/O
- Entrée : `AnalyticsFilters` + `now`.
- Sortie : `topPages: OverviewPageRow[]` (`{ pageRoute, pageViews, sessions }`), limit 10, trié `pageViews`
  desc.
- Source : `fetchEvents()` (mêmes remarques consentement que A01 : overview ne filtre PAS `granted`).
- Filtre interne bloquant : `if (e.eventName !== 'page_view') continue;` (L355).

## Cas limites & non-happy-path
- **Dataset prod réaliste** (0 `page_view`, 339 `view_item` sur `/kit`) → `byPage` vide → `topPages = []`.
  C'est le bug « toujours vide ».
- **Dataset mixte page_view + view_item** → seuls les `page_view` apparaissent (ignore les view_item),
  donc une page sans page_view mais riche en view_item est invisible.
- **pageRoute vide/`null`** : `String(row.page_route)` côté DB peut produire `''` ou `'null'` ; après fix,
  écarter les routes vides ou les regrouper sous `(inconnu)`.
- **Égalité de volume** : tri stable attendu, top 10 tronqué.
- **Consentement** (AN-07, partagé avec A01) : routes comptées incluent le trafic `denied`.

## Invariants couverts
- **INV-OVERVIEW-TOPPAGES** : les routes affichées proviennent d'événements réellement émis ; jamais une
  liste vide structurelle parce que `page_view` n'existe pas.
- Lacune adressée : désalignement taxonomie `view_item` (émis) vs `page_view` (attendu par topPages).

## Critères d'acceptation (observables)
- [REPRO] Sur fixture prod, `getOverviewData(...).topPages` est `[]` → prouve « top pages vide ».
- [SPEC] Après fix, `topPages[0].pageRoute === '/kit'` et `topPages[0].pageViews > 0` ; le tri est
  `pageViews` desc ; `sessions` ≤ `pageViews`.
- [SPEC] Une route présente uniquement via `view_item` (jamais `page_view`) apparaît tout de même.

## Points à vérifier — tous points de vue
- **Backend** : élargir le prédicat de `topPages()` (L355) et `countPageViews()` à la définition de
  « page vue » retenue (émettre `page_view` OU compter `view_item`/events de page) ; aligner avec A01
  (même définition partout) ; appliquer le filtre `analytics_storage='granted'` en amont (`fetchEvents`).
- **Frontend** : `OverviewTopPages` doit gérer l'état vide réel (« aucune page vue ») distinct du bug.
- **UI/UX/design** : routes lisibles (ex. `/kit` plutôt qu'URL brute), pas d'emoji.
- **Data** : que compte-t-on comme « vue » sur une SPA mono-page (sections /kit = même route) ? éviter de
  sur-compter les `view_item` répétés d'une même session si la métrique vise des « pages ».
- **A11y** : tableau avec en-têtes `th scope=col`, tri annoncé.
- **i18n** : en-têtes FR/AR, libellé d'état vide.
