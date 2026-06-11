# Tests — Onglet CTA

> Fonctionnement optimal + éléments à vérifier sur tous les PoV. Cas dans
> [`cas-de-tests.csv`](cas-de-tests.csv). Findings prioritaires : **AF-02 (revenu ÷100)**, AF-01.

## 1. Fonctionnement optimal (la cible)

Mesure la performance des CTA : KPI globaux (impressions, clics, taux de conversion, **revenu
attribué en MAD**), table par `component_id` (label, rôle, page majoritaire, impressions, clics,
achats attribués, revenu, CTR, conversion, badge `isDeleted`), top messages (par label), top pages.

**Attribution last-click** : achat → dernier `cta_click` de la même session avant l'achat ; sinon
dernier clic du même `anonymous_id` dans les 7 j. 1 crédit par achat.

**Invariants de justesse** :
- `Σ rows.impressions = totals.impressions` (idem clics, achats, revenu).
- `clickRate = clics/impressions`, `conversionRate = achats/clics` ; `null` si dénominateur 0.
- **Revenu en unité/devise correctes** : un achat de **199 MAD** ⇒ revenu **199 MAD** (pas 1,99).
  ← **AF-02 : le cœur du verrou.**
- Attribution : pas de double crédit ; fallback 7 j fonctionne ; aucun crédit hors fenêtre.
- `isDeleted` reflète `tracking_components.deletedAt`.
- top pages réconciliable avec totals (F-CTA-02) ; ordre déterministe sur égalité (F-CTA-04).

**Comportement UI** : changement de filtre → KPI + table + top messages + top pages refetch
(AF-01) ; devise **MAD** (F-CTA-05) ; lignes `clics=0/achats>0` **expliquées** (F-CTA-03) ;
EmptyState/ErrorState.

## 2. À vérifier par point de vue

| PoV | Vérifications |
|---|---|
| **Data (Vitest)** | attribution session puis fallback 7 j ; 1 crédit/achat ; **revenu MAD** (AF-02) ; totals = somme rows ; conv/ctr null si 0 ; topPages.purchases vs totals (F-CTA-02) ; tri déterministe (F-CTA-04) ; consent gate ; fuseau |
| **Backend (MSW)** | `GET /cta` ; 401 sans session ; shape (totals/rows/topMessages/topPages) |
| **Frontend (RTL)** | refetch au changement (AF-01) ; badge isDeleted ; montants MAD ; loading/empty/error ; tooltip d'attribution |
| **UI/UX (Playwright)** | revenu plausible en MAD ; top 10 limité ; tri par achats ; explication clics=0/achats>0 |
| **a11y** | table accessible ; badge avec texte (pas couleur) ; tri annoncé ; tooltip clavier |
| **Perf** | 1 fetch au mount ; fenêtre 7 j fetch élargie maîtrisée |

## 3. Extrait de spec (data — AF-02, le test décisif)

```ts
it('FN-CTA-09/AF-02 — 199 MAD attribué = 199 MAD de revenu (pas 1,99)', async () => {
  seedComponents([{ id: 'c1', name: 'Acheter', category: 'cta_primary' }]);
  seedEvents([
    ev('cta_click', { sessionId:'s1', anonymousId:'a1', componentId:'c1', pageRoute:'/kit',
                      at:'2026-05-20T10:00:00Z', payload:{ cta_intent:'purchase' } }),
    ev('purchase',  { sessionId:'s1', anonymousId:'a1', at:'2026-05-20T10:03:00Z',
                      payload:{ value: 199, currency:'MAD' } }),
  ]);
  const d = await getCtaData(filters({ period:'7d' }), ANCHOR);
  expect(d.totals.revenueAttributedCents).toBe(19900); // 199,00 MAD ; rouge tant que AF-02 vit
});
```

## 4. Extrait de spec (data — fallback 7 j)

```ts
it('FN-CTA-08 — clic J-3 attribué a l’achat du jour (même anonymous_id)', async () => {
  seedComponents([{ id:'c1', name:'CTA', category:'cta_primary' }]);
  seedEvents([
    ev('cta_click', { sessionId:'old', anonymousId:'a1', componentId:'c1', pageRoute:'/kit',
                      at:'2026-05-17T09:00:00Z', payload:{ cta_intent:'purchase' } }),
    ev('purchase',  { sessionId:'new', anonymousId:'a1', at:'2026-05-20T09:00:00Z',
                      payload:{ value: 320, currency:'MAD' } }),
  ]);
  const d = await getCtaData(filters({ period:'today' }), ANCHOR);
  expect(d.rows.find((r)=>r.componentId==='c1')?.purchasesAttributed).toBe(1);
});
```
