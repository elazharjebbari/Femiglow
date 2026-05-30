# 03 — Système CTA (`/admin/analytics/cta`)

Fichiers : `lib/analytics/queries/cta.ts` (523) · `app/api/admin/analytics/cta/route.ts` ·
`components/admin/analytics/cta/{CtaDashboard,CtaKpiGrid,CtaTable,CtaTopMessages,CtaTopPages}.tsx`.

## 1. Fonctionnement optimal

Mesurer la performance des **call-to-action** : KPI globaux (impressions, clics, taux de
conversion, **revenu attribué**), table principale **par `component_id`** (label, rôle/catégorie,
page d'origine majoritaire, impressions, clics, achats attribués, revenu, CTR, taux de conversion,
badge `isDeleted`), **top messages** (regroupés par label) et **top pages** (orthogonal, par
`page_route`).

**Attribution** (`attributePurchases`, `cta.ts:253`) — last-click :
1. dernier `cta_click` de la **même session** avant le `purchase` ; sinon
2. dernier `cta_click` du **même `anonymous_id`** dans les **7 j** précédents.
La fenêtre de fetch est élargie à `from − 7 j` pour fiabiliser le fallback.

## 2. Justesse — analyse

✅ **Last-click bien implémenté** : pré-index `clicksBySession` / `clicksByAnon`, `lastBefore`
borne le temps, 1 attribution par achat, plusieurs achats cumulent sur un CTA.

🔴 **AF-02 (revenu ÷ ~100) — défaut de précision majeur.** `attributePurchases` lit la valeur via
`readNumber(p.payload, 'value', 'amount', 'amount_cents')` (`cta.ts:297`) et la stocke dans
`valueCents`. Or les events checkout émettent `value` en **unité majeure MAD** (Enhanced Ecommerce
GA4, `checkout-events.ts:21` : « currency / value / items[] » ; `value: input.value` sans ×100).
Ensuite `CtaKpiGrid`/`CtaTable` formatent via `formatCurrency(cents)` qui **divise par 100**
(`format.ts:53`). Résultat : un achat de **199 MAD** est compté **1,99 MAD**. Le KPI « revenu
attribué » et la colonne revenu sont **~100× trop bas** (sauf si un `amount_cents` explicite est
présent, ce que le tracking n'émet pas).
→ Soit l'attribution convertit en cents (`value*100`), soit le format ne divise pas. À trancher et
**verrouiller par test** (voir `20-test-strategy/cta`).

⚠️ **F-CTA-02 (top pages incohérent avec totals)** : `cta.ts:198` n'incrémente `purchases` d'une
page que si `byPage.get(att.clickPageRoute)` existe ; or `byPage` n'est rempli qu'avec les events
**intra-période**. Un achat dont le clic vient du **fallback 7 j** (page non vue dans `[from,to]`)
**n'est pas compté** dans top pages → `Σ topPages.purchases ≤ totals` (écart silencieux).

⚠️ **F-CTA-03 (clics=0, purchases>0 légitime mais déroutant)** : commenté `cta.ts:158`. Une ligne
peut afficher 0 clic et des achats (clic hors période, attribué via fallback). Correct
sémantiquement mais **doit être expliqué** dans l'UI (sinon « bug » perçu).

⚠️ **F-CTA-04 (label/page « majoritaire »)** : `label = defaultParams.label || name || id` ; page =
la plus cliquée (`topByCount`). En cas d'égalité, l'ordre d'itération de la `Map` décide → résultat
**non déterministe** sur égalité parfaite. Mineur mais testable.

✅ **Composants soft-deleted** conservés avec badge `isDeleted` (bonne pratique : l'historique reste
lisible même si le composant a été supprimé).

## 3. Réactivité & UI

🔴 **AF-01** : `CtaDashboard.tsx:33` fige `useState(initialFilters)` → filtres inopérants après
mount. Double fetch au mount (`CtaDashboard.tsx:44`).

⚠️ **Devise codée `EUR` par défaut** (`CtaDashboard` prop `currency='EUR'`) alors que le business
est **MAD**. À vérifier : la page passe-t-elle la bonne devise ? Sinon le symbole affiché est faux
(€ au lieu de MAD), **en plus** de l'erreur d'unité AF-02.

## 4. Points à vérifier / tester

| PoV | À garantir |
|---|---|
| **Précision data** | Revenu attribué = somme réelle des `value` des achats attribués, **dans la bonne unité et la bonne devise** (MAD). CTR = clics/impressions ; conv = achats/clics ; null si dénominateur 0. |
| **Attribution** | Achat dans la session → crédite le dernier clic avant l'achat ; sinon fallback 7 j même `anonymous_id` ; aucun crédit si aucun clic dans la fenêtre ; pas de double-crédit. |
| **Cohérence** | `Σ rows.impressions = totals.impressions` (idem clics/achats/revenu) ; expliquer/réconcilier `topPages.purchases` vs totals (F-CTA-02). |
| **Fonctionnel UI** | Changer period/device/traffic rafraîchit KPI + table + top messages + top pages. Tri table par achats desc. Badge `isDeleted` visible. EmptyState si aucune donnée. |
| **Edge cases** | clics=0 + achats>0 affichés et expliqués ; label vide → fallback ; égalité de page majoritaire déterministe (après correctif). |
| **UX/Design** | Montants formatés MAD (sans décimale), %, tooltips d'attribution, top 10 limité, responsive. |
| **a11y** | Table accessible, ordre de tri annoncé, badges avec texte (pas couleur seule). |

## 5. Findings (extrait)

| ID | Sév. | Résumé |
|---|---|---|
| AF-01 | P0 | Filtres ne rafraîchissent pas le dashboard |
| AF-02 | P1 | Revenu attribué ÷ ~100 (unité MAD lue comme cents) |
| F-CTA-02 | P2 | topPages.purchases non comptés si clic via fallback hors période |
| F-CTA-03 | P2 | clics=0 + achats>0 non expliqué dans l'UI |
| F-CTA-05 | P2 | devise EUR par défaut au lieu de MAD |
