# 7. Tests

## Stratégie

3 niveaux : unit (pure functions), integration (API + DB), E2E (real flow).

## Unit

### `channel-detector.test.ts`

| # | URL | Référent | Attendu |
|---|---|---|---|
| 1 | `?gclid=abc` | — | `google_ads / gclid:abc / is_paid:true` |
| 2 | `?gbraid=xyz` | — | `google_ads / gbraid:xyz / is_paid:true` |
| 3 | `?fbclid=fb1` | — | `meta / fbclid:fb1` |
| 4 | `?ttclid=tt1` | — | `tiktok` |
| 5 | `?sccid=sn1` | — | `snap` |
| 6 | `?utm_source=google&utm_medium=cpc` | — | `google_ads / utm-based` |
| 7 | `?utm_source=instagram&utm_medium=paid` | — | `meta` (IG = Meta) |
| 8 | `?utm_medium=email&utm_source=newsletter` | — | `email / is_paid:false` |
| 9 | (vide) | `https://google.com/aclk` | `organic` |
| 10 | (vide) | `https://facebook.com/...` | `social_organic` |
| 11 | (vide) | — | `direct` |
| 12 | `?gclid=g1&fbclid=f1` | — | **priorité gclid** = `google_ads` |

### `strategy.test.ts`

Pour chaque stratégie × scénarios :
- Pas d'historique → `direct`
- 1 paid touch → ce touch
- 3 paid touches → first vs last selon strat
- Mix paid + non-paid → strat `last_touch` vs `last_paid_touch` divergent
- Stratégie `broadcast` → channel `broadcast`

### `repository.test.ts`

- Insert new visitor → first_touch == last_touch == input
- Update visitor existant → first préservé, last updated
- LRU `paid_history` : 21e paid touch → pop le plus ancien
- Dedup `paid_history` : même `click_id` pas dupliqué

## Integration

### POST `/api/track/attribution`

- Body invalide → 400
- visitor_id manquant → 400
- Insert OK → 201 + row en DB
- Update OK (existing visitor) → 200 + first préservé

### GET inspect (admin)

- Auth requise (admin session)
- Renvoie snapshot + résolution attendue avec strat active
- Renvoie 404 si visitor unknown

## E2E Playwright

### Spec 1 — Capture au landing

```ts
test('visiteur Google Ads → cookie + DB', async ({ page }) => {
  await page.goto('https://prod/?gclid=e2e_test_001');
  const cookies = await page.context().cookies();
  const fgAttr = cookies.find(c => c.name === 'fg_attr');
  expect(fgAttr?.value).toContain('google_ads');
  // Vérif DB via API admin /inspect
});
```

### Spec 2 — dataLayer annoté

```ts
test('purchase fire avec attribution.channel', async ({ page }) => {
  await page.goto('https://prod/?fbclid=e2e_test_002');
  await page.evaluate(() => window.dataLayer = []);
  // Simuler une conversion
  await completeCheckoutFlow(page);
  const purchaseEntries = await page.evaluate(() =>
    window.dataLayer.filter(e => e.event === 'purchase')
  );
  expect(purchaseEntries[0]?.attribution?.channel).toBe('meta');
});
```

### Spec 3 — GTM conditional firing

```ts
test('visiteur Google Ads ne fire pas Meta pixel', async ({ page }) => {
  await page.goto('https://prod/?gclid=e2e_test_003');
  // Intercept fetch vers facebook.com/tr (Meta pixel)
  const metaPixelCalls = [];
  page.on('request', (req) => {
    if (req.url().includes('facebook.com/tr')) metaPixelCalls.push(req.url());
  });
  await completeCheckoutFlow(page);
  expect(metaPixelCalls).toHaveLength(0);
});
```

### Spec 4 — Stratégie configurable

```ts
test('change strategy → next event respecte la nouvelle', async () => {
  await loginAsAdmin();
  await setAttributionStrategy('first_paid_touch');
  // Reset visitor avec historique paid_history = [meta, google_ads]
  await primeAttribution({ paid_history: [meta_touch, google_touch] });
  await visitSite(); // n'ajoute pas de touch
  // Conversion → attribution.channel should be 'google_ads' (first_paid_touch)
  const purchaseEntry = await captureNextPurchase();
  expect(purchaseEntry.attribution.channel).toBe('google_ads');
});
```

## Couverture cible

- **Unit** : 100% des branches de `channel-detector` et `strategy`
- **Integration** : 100% des endpoints API
- **E2E** : 4 scénarios principaux (capture / annotate / fire / strategy)

## Tests de non-régression

Ajout au pipeline CI :
- Vérifier que les events d'audience (page_view, view_item) ont
  `attribution.channel` mais que le tag fire toujours
- Vérifier qu'un visiteur sans cookie `fg_attr` (1er hit jamais POSTé)
  obtient `attribution.channel === 'unknown'` (pas `direct`) → fallback
  défaut `broadcast`
