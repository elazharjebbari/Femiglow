# Tests — Onglet Checkout

> Fonctionnement optimal + vérifications tous PoV. Cas : [`cas-de-tests.csv`](cas-de-tests.csv).
> Findings : AF-01, **AF-03 (progression > 100 %)**, F-CHK-02/03/04.

## 1. Fonctionnement optimal (la cible)

4 KPI + funnel 6 étapes (`view_cart → begin_checkout → add_shipping → add_payment → submit →
purchase`) + histogramme **time-to-submit** + top erreurs formulaire + top champs abandonnés.

**Invariants de justesse** :
- chaque étape = nb de sessions distinctes ayant émis l'event (BOOL_OR).
- **AF-03** : si on garde le modèle indépendant, la **progression doit être clampée/expliquée**
  (begin_checkout peut dépasser view_cart) ; sinon aligner sur cumul strict. Le test fige la
  décision.
- `submissions = purchases` (renommer ou documenter — F-CHK-02) ; `serverFallbackPurchases ≤
  submissions`.
- **abandons** : `begin_checkout` sans `purchase` **après expiration** de la fenêtre 60 min
  (F-CHK-04), et pas de faux positif au bord de période (F-CHK-03).
- **time-to-submit** : durée `begin_checkout → purchase`, bot `<1 s` exclu, outlier `>30 min`
  cappé, 12 buckets de 50 s (dernier = overflow), percentiles P25/50/75/95 corrects, `sampleSize`.
- `add_shipping_info ≡ add_shipping`, `add_payment_info ≡ add_payment`, `checkout_submit ≡ submit`,
  `purchase`/`purchase_server` → purchase (+ submit implicite).

**Comportement UI** : changement de filtre → 4 zones refetch (AF-01) ; histogramme lisible ; tables
top 20 erreurs / top 10 champs ; EmptyState/ErrorState ; durées formatées (`2m 5s`).

## 2. À vérifier par point de vue

| PoV | Vérifications |
|---|---|
| **Data (Vitest)** | étapes BOOL_OR ; progression clampée (AF-03) ; abandons règle 60 min + bords (F-CHK-03/04) ; TTS bot/outlier/percentiles/sampleSize ; alias d'events ; submit implicite ; server fallback isolé ; consent ; fuseau |
| **Backend (MSW)** | `GET /checkout` ; 401 ; shape (totals/steps/timeToSubmit/topErrors/topAbandonedFields) |
| **Frontend (RTL)** | refetch (AF-01) ; stepper ; histogramme 12 buckets ; tables ; loading/empty/error |
| **UI/UX (Playwright)** | décrochage visible ; top champ abandonné = phone ; durées formatées ; KPI cohérents |
| **a11y** | stepper + histogramme avec équivalent textuel ; tables `<th>` ; couleur non porteuse seule |
| **Perf** | 1 fetch au mount ; fenêtre longue maîtrisée |

## 3. Extrait de spec (data — abandons & bord de fenêtre)

```ts
it('FN-CHK-11/F-CHK-03 — purchase juste après fin de période n’est pas un abandon', async () => {
  // begin_checkout a t-10min de 'to', purchase a 'to'+5min (hors fetch naïf)
  seedEvents([
    ev('begin_checkout', { sessionId:'s1', at:'2026-05-20T11:50:00Z' }),
    ev('purchase',       { sessionId:'s1', at:'2026-05-20T12:05:00Z', payload:{ value:199 } }),
  ]);
  const d = await getCheckoutData(filters({ period:'custom', from:'2026-05-13', to:'2026-05-20' }), ANCHOR);
  expect(d.totals.abandons).toBe(0); // rouge tant que la fenêtre de fetch des purchases n'est pas élargie
});
```

## 4. Extrait de spec (data — time-to-submit)

```ts
it('FN-CHK-10 — bot <1s exclu, outlier >30min cappé, percentiles', async () => {
  seedEvents([
    ...begtoPurchase('bot', 0.4),    // exclu
    ...begtoPurchase('fast', 90),    // 1m30
    ...begtoPurchase('slow', 5400),  // 90min -> cappé a 1800
  ]);
  const d = await getCheckoutData(filters({ period:'7d' }), ANCHOR);
  expect(d.timeToSubmit.sampleSize).toBe(2);
  expect(d.timeToSubmit.p50).toBeLessThanOrEqual(1800);
});
```
