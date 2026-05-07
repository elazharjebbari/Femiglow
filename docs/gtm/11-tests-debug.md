# 11 — Tests & debug

> *Tag Assistant, Preview, GA4 DebugView, Meta Test Events, Playwright*

---

## 1. Pyramide de tests

```
                    ┌─────────────────────┐
                    │  Audit production   │   1 / mois
                    │  (Match Quality,    │
                    │  events vs orders)  │
                    └─────────────────────┘
                ┌──────────────────────────────┐
                │   E2E Playwright              │   à chaque PR
                │   (10 parcours datalayer)     │
                └──────────────────────────────┘
            ┌────────────────────────────────────────┐
            │   Tag Assistant Preview                │   à chaque change GTM
            │   (manuel ou scripté)                  │
            └────────────────────────────────────────┘
        ┌──────────────────────────────────────────────────┐
        │   Generator unit tests                            │   à chaque PR
        │   (build* functions, structurally valid)         │
        └──────────────────────────────────────────────────┘
```

## 2. Tests unitaires du générateur

`docs/gtm/scripts/__tests__/gtm-generate.test.ts` :

```ts
describe('gtm-generate', () => {
  it('produit 1 trigger Custom Event par event du catalogue', () => {
    const triggers = buildAllCustomEventTriggers();
    expect(triggers).toHaveLength(EVENT_CATALOG.length);
    for (const ev of EVENT_CATALOG) {
      expect(triggers.find(t => t.name === `CE — ${ev.name}`)).toBeDefined();
    }
  });

  it('ne crée un tag GA4 que pour les events avec provider google_ga4', () => {
    const tags = EVENT_CATALOG.flatMap(ev => buildGa4EventTag(ev, []) ? [ev.name] : []);
    expect(tags).toEqual(EVENT_CATALOG.filter(ev => ev.defaultProviders.includes('google_ga4')).map(ev => ev.name));
  });

  it('ne crée un tag Meta que si un mapping existe', () => {
    for (const ev of EVENT_CATALOG) {
      const tag = buildMetaEventTag(ev, []);
      const mapped = mapEventName(ev.name, 'meta');
      expect(!!tag).toBe(!!mapped);
    }
  });

  it('valide le JSON contre le schéma container GTM', () => {
    const container = buildContainer(specFixture);
    expect(() => containerJsonSchema.parse(container)).not.toThrow();
  });
});
```

## 3. Tests E2E Playwright — 10 parcours datalayer

`apps/web/e2e/tracking-gtm.spec.ts` :

```ts
test('purchase event est poussé avec les bons champs', async ({ page }) => {
  await page.goto('/');
  await acceptConsent(page);                     // helper
  await page.click('text=Le rituel');
  await page.goto('/kit');
  await page.click('button:has-text("Recevoir le rituel")');
  // ... finir checkout sur stub
  await page.waitForURL('**/merci**');

  const purchaseEvents = await page.evaluate(() =>
    (window as any).femiglowDataLayer.entries.filter((e: any) => e.event === 'purchase')
  );

  expect(purchaseEvents).toHaveLength(1);
  const ev = purchaseEvents[0];
  expect(ev.event_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(ev.ecommerce.value).toBeGreaterThan(0);
  expect(ev.ecommerce.currency).toBe('MAD');
  expect(ev.ecommerce.items).toHaveLength(1);
  expect(ev.ecommerce.transaction_id).toMatch(/^ORD-/);
  expect(ev.consent.analytics_storage).toBe('granted');
});
```

### 3.1 Parcours à couvrir

1. `page_view` à l'arrivée sur `/`
2. `view_item` sur `/kit`
3. `add_to_cart` après clic CTA
4. `view_cart` à l'ouverture mini-cart
5. `begin_checkout` à l'entrée du tunnel
6. `add_shipping_info`, `add_payment_info`
7. `purchase` complet
8. `generate_lead` via formulaire newsletter
9. `fg_journal_read_75` après scroll d'un article
10. `fg_consent_change` après bandeau

## 4. Tag Assistant manuel

```
1. Installer Chrome extension "Tag Assistant Companion"
2. tagassistant.google.com → Add domain → https://femiglow.ma
3. Tag Assistant ouvre la page en mode debug
4. Naviguer le site, faire les actions à tester
5. Vérifier dans la sidebar :
   - Container GTM-FEMIGLOW connecté ✓
   - Chaque action déclenche les bons tags ✓
   - Pas d'erreur, pas de warning
```

### 4.1 Tests manuels avant chaque release

| Test                                                | Cible                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| Page `/` charge sans erreur tag                     | 0 erreur, 0 warning Tag Assistant                          |
| Bandeau consent → Accepter                          | Tags `Meta Init`, `TikTok Init`, etc. fire après          |
| Bandeau consent → Refuser                          | Tags `GA4 Cfg`, `GA4 Evt — page_view` fire ; pixels non |
| Add to cart                                         | `GA4 Evt — add_to_cart` + `Meta Evt — AddToCart` fire    |
| Purchase                                            | Tous les tags conversion fire avec `event_id`            |

## 5. GA4 DebugView

```
1. Activer le debug mode :
   - URL avec ?gtm_debug=x ou Chrome ext "GA Debugger"
2. GA4 → Admin → DebugView
3. Faire les actions sur le site
4. Vérifier que chaque event apparaît dans la timeline
5. Cliquer sur un event → vérifier params, user_properties
```

### 5.1 Validation de la consentement

DebugView affiche `consent_state` pour chaque event :

- `denied` : consent refusé → modélisation activée
- `granted` : consent accepté → tracking complet

## 6. Meta Events Manager → Test Events

```
1. Meta Business Manager → Events Manager → ton Pixel
2. Onglet "Test Events"
3. Saisir l'URL de test (ex. https://femiglow.ma)
4. Récupérer le code de test : EVENT_TEST_CODE_xxx
5. Côté GTM, ajouter ce code dans le tag Meta Init :
   fbq('init', PIXEL_ID, advancedMatching, { test_event_code: 'TEST_xxx' });
6. Naviguer le site
7. Vérifier les events arrivent en temps réel dans Test Events
```

### 6.1 Vérifications attendues

| Métrique                              | Cible       |
| ------------------------------------- | ----------- |
| Event Match Quality                   | ≥ 7 / 10    |
| Champ `event_id` présent              | sur tous les events de conversion |
| Champ `em` (email_sha256) présent     | sur `Purchase`, `Lead`, `CompleteRegistration` |
| Pas d'erreur de format                | aucune      |

## 7. TikTok Pixel Helper

Extension Chrome **TikTok Pixel Helper** :

- charge la page → onglet Helper
- vérifie : Pixel ID détecté, events poussés, paramètres présents.

## 8. Snap Pixel Helper, Pinterest Tag Helper

Idem — extensions Chrome dédiées.

## 9. Lighthouse CI — perf

```
.github/workflows/lighthouse.yml :

- name: Lighthouse
  run: npm run lighthouse:ci -- --collect.url=https://preview.femiglow.ma/kit
```

Cibles :

- Performance ≥ 90
- Best Practices ≥ 95
- SEO ≥ 95
- Accessibility ≥ 95

## 10. Audit événements vs commandes (mensuel)

Script `apps/web/scripts/tracking-audit.ts` :

```ts
// Pour le mois écoulé :
// 1. compte purchases en GA4 (BigQuery export)
// 2. compte purchases en Meta Events Manager
// 3. compte commandes en base interne
// 4. produit un rapport CSV des écarts

const ga4 = await fetchGa4PurchaseCount(month);
const meta = await fetchMetaPurchaseCount(month);
const internal = await db.execute(sql`SELECT count(*) FROM orders WHERE created_at >= ...`);

const report = {
  internal: internal,
  ga4_match_rate: ga4 / internal,
  meta_match_rate: meta / internal,
  delta_pct_ga4: ((ga4 - internal) / internal) * 100,
  delta_pct_meta: ((meta - internal) / internal) * 100,
};
```

Cible : écart < 3 % entre interne et providers.

## 11. Drift detection

Script `pnpm tsx docs/gtm/scripts/gtm-diff.ts --env=production` :

```
✗ DRIFT detected
  + tag : GA4 Evt — fg_new_event (in code, not in GTM)
  ~ tag : Meta Evt — Purchase (params differ)
  - tag : Old Tag (in GTM, not in code)
```

À tourner :
- automatiquement chaque push sur `main` (CI)
- manuellement avant chaque audit mensuel

## 12. Tests d'erreur

| Erreur attendue                                     | Comportement attendu                                   |
| --------------------------------------------------- | ------------------------------------------------------ |
| `window.fbq` indéfini (Meta non chargé)             | Le tag Custom HTML ne plante pas la page                |
| Provider tiers timeout                              | Tag fire, le browser tolère, les events suivants OK    |
| `event` absent du DLV (push mal formé)              | GTM ignore                                              |
| `ecommerce.items` est undefined sur un purchase     | Le tag GA4 pousse `[]` (mapper protège contre le null) |
| Adblocker bloque GTM                                | Site fonctionne normalement, juste pas de tracking     |

## 13. Lecture suivante

- [12 — Runbook](12-runbook.md)
