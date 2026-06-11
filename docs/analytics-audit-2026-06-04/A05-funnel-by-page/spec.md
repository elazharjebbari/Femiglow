# A05 — Funnel par page d'entrée (DataTable « par première page »)

## Rôle & surface
Sous-vue de l'onglet **Funnel** : décompose l'entonnoir par **page d'entrée** (`firstPage` de la
session). Source : `apps/web/src/lib/analytics/queries/funnel.ts` → `getFunnelByPage(filters, now)`
(L234-276). Affichage : `components/admin/analytics/funnel/FunnelByPage.tsx`. Pour l'opérateur :
« quelles landing pages convertissent le mieux (views → cta → buy) ».

Calcul par page (L252-258) :
```
if (s.view) acc.views += 1;
if (s.view && s.engage && s.cta) acc.ctas += 1;                      // cumul strict
if (s.view && s.engage && s.cta && s.checkout && s.purchase) acc.purchases += 1;  // cumul strict
```
Lignes finales filtrées `views > 0` (L262), triées par `views` desc. `firstPage` = page du **premier**
event de la session par `receivedAt` asc (`aggregateSessions` L362-365), défaut `/` si absente.

## Fonctionnement optimal (ce qui DOIT se passer)
Pour chaque page d'entrée, l'opérateur voit `views`, `viewToCta` (cta/views), `ctaToBuy`
(purchases/cta) et `purchases`. Une landing `/kit` qui reçoit des sessions ayant acheté doit afficher
`ctas > 0` et `purchases > 0`, pas seulement des `views`. Les ratios `viewToCta`/`ctaToBuy` doivent être
exploitables pour comparer les pages.

## Contrat I/O
- Entrée : `AnalyticsFilters` + `now`.
- Sortie : `FunnelByPageData { range, rows: FunnelByPageRow[] }`.
  `FunnelByPageRow { pageRoute, views, viewToCta:number|null, ctaToBuy:number|null, purchases }`.
  - `viewToCta = views>0 ? ctas/views : null`.
  - `ctaToBuy = ctas>0 ? purchases/ctas : null`.
- Filtre : `fetchEvents` (consent granted + période + device + traffic).

## Cas limites & non-happy-path — colonnes mortes (preuves DB)
- `getFunnelByPage` réutilise **exactement** la même condition cumulative stricte que A03 pour `ctas` et
  `purchases` (`s.view && s.engage && s.cta …`, L256-257). Or `s.engage === false` pour toutes les
  sessions (events engage absents : `scroll_depth_50`/`cta_impression`/`video_user_play` = 0 en base).
- Conséquence : **seule la colonne `views` est peuplée**. `ctas = 0` et `purchases = 0` pour **toutes**
  les pages, donc :
  - `viewToCta = 0/views = 0` (ratio nul partout).
  - `ctaToBuy = null` (car `ctas = 0`).
  - `purchases = 0` partout.
- Symptôme rapporté (README §0.3) : « funnel par page d'entrée vide (sauf views) ».
- `firstPage` dépend de `e.pageRoute` du premier event : en prod, `view_item` porte `page_route = '/kit'`
  → la page d'entrée majoritaire sera `/kit`. Une session sans `pageRoute` non vide ⇒ `firstPage = '/'`.
- Filtre `views > 0` : une page qui n'a jamais de `view` (ni `view_item` ni `page_view` sur `/kit`)
  est **exclue** des lignes — cohérent, mais masque l'absence d'instrumentation des autres pages.

## Direction de fix (cf. findings-register AN-02)
Dérivé de A03 : remplacer le cumul strict (`view && engage && cta …`) par la même logique corrigée
(max-rank / OR par étape, conversion = purchase OR generate_lead) pour que `ctas` et `purchases` se
peuplent dès que `add_to_cart`/`begin_checkout`/`purchase`/`generate_lead` existent, indépendamment de
l'étape `engage`.

## Invariants couverts
- INV (cohérence avec A03) : `Σ pages.views = steps.view.sessions` ; idem ctas/purchases une fois le
  modèle corrigé.
- INV (ratios) : `viewToCta ∈ [0,1]∪null` ; `ctaToBuy ∈ [0,1]∪null` ; `null` quand dénominateur 0.
- INV (firstPage) : page du premier event ; défaut `/`.
- Lacune : **AN-02** (cumul strict propagé à by-page).

## Critères d'acceptation (observables)
- `[reproduction]` Dataset prod-like (sessions `/kit` avec view_item+begin_checkout+purchase, sans
  engage) ⇒ ligne `/kit` avec `views = N`, `ctas`-dérivés `viewToCta === 0`, `ctaToBuy === null`,
  `purchases === 0`.
- `[reproduction]` Aucune ligne n'a `purchases > 0` malgré 13 purchases réels.
- `[reproduction]` Une page sans `view` (ex. `/rituel` sans view_item) est absente des `rows`.
- `[SPEC après-fix]` Même dataset ⇒ ligne `/kit` avec `purchases ≥ 1` et `viewToCta > 0`,
  `ctaToBuy` exploitable (non `null`).
- `[SPEC après-fix]` `Σ rows.purchases === steps.purchase.sessions` (cohérence A03↔A05).

## Points à vérifier — tous points de vue
- **Backend** : conditions L256-257 (cumul strict), filtre `views>0` L262, calcul `firstPage`.
- **Frontend** : `FunnelByPage.tsx` rend une table « views seulement » comme « presque vide ».
- **UI/UX** : distinguer « page vue mais non instrumentée en aval » d'une vraie page sans conversion.
- **Data** : `firstPage` cohérent avec `page_route` (`/kit` majoritaire) ; dépend de A00/A03.
- **A11y / i18n** : en-têtes de colonnes FR/AR ; tri accessible ; ratios formatés.
