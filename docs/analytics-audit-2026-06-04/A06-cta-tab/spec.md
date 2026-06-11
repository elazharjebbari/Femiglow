# A06 — Onglet CTA (impressions / clics / attribution last-click / revenu)

## Rôle & surface
Onglet **CTA** de `/admin/analytics`. Source : `apps/web/src/lib/analytics/queries/cta.ts` →
`getCtaData(filters, now)`. Affichage : `components/admin/analytics/cta/*`. Pour l'opérateur : « quels
CTA génèrent des clics, des achats et du revenu ; quel message/page performe ».

Pipeline :
- KPI & rows par `component_id` (L120-167) : `impressions` comptent `cta_impression`, `clicks`
  comptent `cta_click`, le tout **uniquement** sur events ayant un `componentId` (L125).
- Attribution `attributePurchases` (L264-317) : pour chaque `purchase` dans `[from,to)`, on cherche le
  **dernier** `cta_click` antérieur dans la session (`lastBefore`), sinon **fallback 7j** même
  `anonymous_id` (`ATTRIBUTION_WINDOW_MS = 7j`, L35 ; fetch élargi `from - 7j`, L106).
- Revenu : `readValueCents(payload)` (L545-551).

## Fonctionnement optimal (ce qui DOIT se passer)
L'opérateur voit, par CTA : impressions, clics, `clickRate = clicks/impressions`, achats attribués
(last-click + fallback 7j), revenu attribué (en cents, affiché en MAD), `conversionRate`. Les `topMessages`
(group by label) et `topPages` (group by page_route) se peuplent. Le revenu d'un achat de 320 MAD doit
valoir **32000 cents** (320 MAD), pas `3.20`.

## Contrat I/O
- Entrée : `AnalyticsFilters` + `now`.
- Sortie : `CtaData { range, totals:CtaKpiTotals, rows:CtaRow[], topMessages, topPages }`.
  `totals { impressions, clicks, conversionRate, revenueAttributedCents }`.
- Attribution : 1 attribution max par purchase (last-click strict). `valueCents = readValueCents(payload)`.
- `revenueAttributedCents` : `readValueCents` lit `amount_cents`/`value_cents` (déjà cents) sinon
  `value`/`amount` (unité majeure MAD) **× 100** (L549).

## Cas limites & non-happy-path — pourquoi tout est vide (preuves DB 90j)
- **`cta_impression` : count 0** ⇒ `acc.impressions` jamais incrémenté (L127) ⇒ `totals.impressions = 0`.
- **`cta_click` : count 0** ⇒ `acc.clicks` jamais incrémenté (L128) ⇒ `totals.clicks = 0`.
- Les **vrais** clics sont émis sous `pack_cta_click`/`video_cta_click`/`composition_post_cta_click`,
  **rejetés à l'ingestion** (cf. A00, AN-03) ⇒ ils n'existent pas en base ⇒ rien à agréger.
- **Attribution effondrée** : `attributePurchases` n'indexe que les `cta_click` (L277). Comme il n'y en a
  **aucun** en base, `clicksBySession`/`clicksByAnon` sont vides ⇒ chaque `purchase` (DB=13) ne matche
  ni la session ni le fallback 7j ⇒ `out = []` ⇒ `purchasesAttributed = 0` et
  `revenueAttributedCents = 0` partout.
- **`rows` vide** : filtre L143 `impressions>0 || clicks>0 || purchasesAttributed>0` ⇒ aucun row (tous
  à 0). `topMessages` et `topPages` également filtrés ⇒ vides. KPI globaux tous à 0/`null`.
- Symptôme rapporté (README §0.4) : « CTA : tout vide ».

### Sur AN-08 (revenu ÷100) — nuance importante constatée en lisant le code
La fonction `readValueCents` (cta.ts L545-551) multiplie **déjà** `value`/`amount` par 100
(`Math.round(major * 100)`, L549) avec un commentaire référant le finding AF-02. **Le bug ÷100 n'est
donc plus reproductible dans la couche d'agrégation** : un `purchase { value: 320 }` produirait bien
`32000` cents (cf. test existant `cta.test.ts` L153). AN-08 est listé « reporté » dans le
findings-register (héritage de l'audit 2026-05-30), pas un défaut frais. Les tests A06 sur le revenu
doivent donc : (a) **prouver l'unité correcte** (320 MAD → 32000 cents) comme garde de non-régression ;
(b) signaler que tout résidu ÷100 se situerait en **couche d'affichage** (format MAD dans
`components/admin/analytics/cta/*`), hors `cta.ts`. Ne pas asserter un bug ÷100 inexistant dans `readValueCents`.

## Direction de fix (cf. findings-register AN-03 / AN-08)
1. AN-03 : ajouter schémas `cta_click`/`cta_impression` (avec `component_id`) **et** émettre ces noms
   depuis `CommanderAnchorButton`/CTAs ; OU normaliser `pack_cta_click → cta_click` à l'ingestion. Une
   fois les clics en base, `getCtaData` se peuple sans changement de code d'agrégation.
2. AN-08 : maintenir l'unité cents homogène (déjà fait dans `readValueCents`) ; vérifier la couche
   format MAD.

## Invariants couverts
- INV (unité revenu) : `value`/`amount` major MAD → cents (×100) ; `*_cents` pris tels quels.
- INV (last-click) : 1 attribution par purchase ; priorité session puis fallback 7j ; jamais de double.
- INV (fallback borné) : clic > 7j avant l'achat non attribué.
- INV (vide légitime) : sans `cta_click`/`cta_impression`, rows/topMessages/topPages vides, totals 0.
- Lacunes : **AN-03** (CTA vide car clics rejetés), **AN-08** (revenu — non-régression unité).

## Critères d'acceptation (observables)
- `[reproduction]` Dataset prod-like (view_item+begin_checkout+purchase, **aucun** cta_click/cta_impression)
  ⇒ `totals.impressions === 0`, `totals.clicks === 0`, `totals.revenueAttributedCents === 0`,
  `rows.length === 0`, `topMessages.length === 0`, `topPages.length === 0`, `totals.conversionRate === null`.
- `[reproduction]` Un `purchase` réel n'est attribué à **aucun** CTA (aucun `cta_click` à matcher).
- `[non-régression AN-08]` `purchase { value: 320 }` attribué à un `cta_click` ⇒ `revenueAttributedCents
  === 32000` (320 MAD en cents, **pas** 3 ni 32000000).
- `[SPEC après-fix AN-03]` Avec `cta_click`/`cta_impression` présents (post-fix taxonomie) ⇒
  `totals.clicks > 0`, `totals.impressions > 0`, et le `purchase` est attribué au dernier `cta_click`
  (last-click) avec le bon revenu.
- `[SPEC après-fix]` Fallback 7j : `cta_click` 3j avant un `purchase` (même `anonymous_id`, autre
  session) ⇒ attribué ; `cta_click` 8j avant ⇒ non attribué.

## Points à vérifier — tous points de vue
- **Backend** : comptage `cta_impression`/`cta_click` (L127-128), filtre rows L143, `attributePurchases`
  (index L277, fallback L298-305, `lastBefore` borné L320-333), `readValueCents` (unité).
- **Frontend** : émetteurs réels (`CommanderAnchorButton` émet `pack_cta_click`) ; format MAD du revenu.
- **UI/UX** : état vide explicite (« aucun clic CTA instrumenté ») vs « pas de données ».
- **Data** : dépend de A00 (clics rejetés) ; tous events granted ; fetch élargi `from-7j` pour le fallback.
- **A11y / i18n** : montants MAD formatés FR/AR ; colonnes triables accessibles ; pas de `%`/emoji (charte).
