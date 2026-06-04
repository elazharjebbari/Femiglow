# A03 — Funnel global (5 étapes : View → Engage → CTA → Checkout → Purchase)

## Rôle & surface
Onglet **Funnel** de `/admin/analytics`, vue « entonnoir global ». Source d'agrégation :
`apps/web/src/lib/analytics/queries/funnel.ts` → `getFunnelOverview(filters, now)`. Affichage :
`components/admin/analytics/funnel/FunnelGlobal.tsx`. Pour l'opérateur : « combien de sessions
atteignent chaque étape, et où je perds du monde ».

Cœur du calcul :
- `FUNNEL_STAGES = [view, engage, cta, checkout, purchase]` (L27).
- Classification par event : `classifyStage(e)` (L138) — `purchase`→purchase, `begin_checkout`→checkout,
  `isCtaEvent`→cta (`add_to_cart`, ou `cta_click` avec `payload.cta_intent==='purchase'`),
  `isEngageEvent`→engage (`scroll_depth_50` | `video_user_play` | `cta_impression`),
  `isViewEvent`→view (`view_item`, ou `page_view` sur `/kit`).
- Agrégation par session : `aggregateSessions` pose `s.view/engage/cta/checkout/purchase = BOOL_OR`.
- **Cumul STRICT en cascade** (L186-192) : `reached.engage = s.view && s.engage` ;
  `reached.cta = s.view && s.engage && s.cta` ; `reached.checkout = view && engage && cta && checkout` ;
  `reached.purchase = view && engage && cta && checkout && purchase`.

## Fonctionnement optimal (ce qui DOIT se passer)
Sur un dataset réaliste (sessions ayant `view_item` + `begin_checkout` + `purchase`, **sans** event
d'engagement intermédiaire), l'opérateur doit voir un entonnoir **non effondré** : les sessions qui ont
réellement converti (begin_checkout, purchase) doivent apparaître aux étapes checkout/purchase, pas
disparaître parce qu'aucun event « engage » n'a été émis. Concrètement, l'étape `purchase` doit refléter
les **13 purchases** réels (et idéalement `purchase OR generate_lead` = conversion COD, AN-06), et
l'étape `checkout` les **97 begin_checkout** réels — au prorata des sessions distinctes.

Modèle cible (fix AN-02) : soit le passage d'étape est **monotone par max-rank atteint** (une session
qui a `begin_checkout` compte automatiquement les étapes amont, même si l'event engage manque), soit
chaque étape est comptée **indépendamment** (OR par étape) plutôt qu'en `AND` cumulatif strict. Le
drop-off devient alors interprétable.

## Contrat I/O
- Entrée : `AnalyticsFilters { period, device, traffic, from?, to? }` + `now: Date`.
- Sortie : `FunnelOverviewData { range, steps: FunnelStep[], totalSessions }`.
  `FunnelStep { stage, sessions, progressionFromPrevious, dropoffToNext, medianTimeToNextSeconds }`.
- Filtrage events (`fetchEvents`, L395) : période `[from, to)` + `consent_snapshot.analytics_storage='granted'`
  + device + traffic. (Tous les events DB sont granted → le filtre consent ne retire rien ici.)

## Cas limites & non-happy-path — la cause racine (preuves DB 90j)
- **DB ABSENT (count 0)** : `scroll_depth_50`, `video_user_play`, `cta_impression` → **aucun** event
  ne satisfait `isEngageEvent`. Donc pour **toute** session, `s.engage === false`.
- Conséquence mécanique du cumul strict (L188-191) : `reached.engage = view && false = false`, et
  par cascade `reached.cta = reached.checkout = reached.purchase = false`. **Aucune session ne dépasse
  l'étape `view`.**
- Résultat observé (reproduction) : avec un dataset `view_item + begin_checkout + purchase`,
  `steps.view.sessions === N`, mais `engage = cta = checkout = purchase === 0`, **alors que**
  `begin_checkout` (DB=97) et `purchase` (DB=13) existent et sont bien classés (`classifyStage`) mais
  jamais comptés (bloqués par le `&&` amont).
- **Étape checkout = `begin_checkout` uniquement** (`classifyStage` L140) : ni `add_to_cart`, ni
  `address_completed`, ni `add_payment_info` ne marquent `checkout` ; seul `begin_checkout` le ferait —
  s'il n'était pas bloqué par le cumul.
- **Étape purchase ignore `generate_lead`** (AN-06) : `classifyStage` ne mappe que `purchase`→purchase.
  Les **17 `generate_lead`** (conversions lead COD) ne sont jamais comptés. Pour un tunnel COD orienté
  lead, conversion = `purchase OR generate_lead`.
- Bord `view` lui-même fragile : `isViewEvent` accepte `view_item` (✓ 339) **et** `page_view` sur `/kit`
  (DB=0). La seule source vivante de `view` est `view_item`.

## Direction de fix (cf. findings-register AN-02 / AN-06)
1. Corriger l'alimentation `engage` (noms réellement émis : `scroll_depth`+`percent_scrolled`, ou
   `cta_impression` réellement émis), **et** assouplir le modèle : étape atteinte par **max-rank**
   (monotone) ou par **OR indépendant** au lieu du `AND` cumulatif strict en cascade.
2. `purchase` = `purchase OR generate_lead` (config COD), documenter la sémantique.
3. Étape `checkout` doit pouvoir s'alimenter de `begin_checkout` même si `engage`/`cta` manquent.

## Invariants couverts
- INV (monotonie funnel) : `step_n ≥ step_{n+1}` doit rester vrai **sans** annuler les conversions
  réelles à cause d'une étape intermédiaire vide.
- INV (conversion COD) : conversion = purchase OR generate_lead.
- Lacunes : **AN-02** (cumul strict + engage absent), **AN-06** (generate_lead ignoré).

## Critères d'acceptation (observables)
- `[reproduction]` Dataset `view_item+begin_checkout+purchase` (sans engage) ⇒ `engage = cta = checkout
  = purchase === 0` et `view === nbSessions`.
- `[reproduction]` `begin_checkout` présent en base n'incrémente PAS `steps.checkout.sessions`.
- `[reproduction]` `generate_lead` présent n'incrémente PAS `steps.purchase.sessions`.
- `[SPEC après-fix]` Même dataset ⇒ `steps.checkout.sessions === nbSessions_avec_begin_checkout` et
  `steps.purchase.sessions === nbSessions_avec_purchase_ou_generate_lead`.
- `[SPEC après-fix]` Monotonie : `view ≥ engage ≥ cta ≥ checkout ≥ purchase`.

## Points à vérifier — tous points de vue
- **Backend** : `classifyStage` (mapping checkout/purchase), `isEngageEvent` (noms), bloc cumul L186-192,
  conversion COD.
- **Frontend** : `FunnelGlobal.tsx` interprète `sessions=0` comme « rien » vs « non instrumenté ».
- **UI/UX** : message explicite « étape non instrumentée » plutôt qu'un 0 trompeur.
- **Data** : alignement noms émis↔attendus (dépend de A00) ; tous events granted.
- **A11y / i18n** : libellés d'étapes FR/AR ; ordre RTL conservé.
