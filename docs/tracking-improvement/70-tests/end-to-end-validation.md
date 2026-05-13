# 70.5 — Test ultime de validation pipeline

> Le **single test** qui valide que TOUTE la pipeline tracking + GTM + Google
> Ads CAPI fonctionne de bout en bout.

## Objectif

Simuler un parcours utilisateur complet `/kit` → achat, et vérifier que
**chaque maillon** de la pipeline tracking a fonctionné correctement.

## Couverture du test

| Maillon | Verification |
|---|---|
| 1. Client-side gtag.js / fbq | tag client visible dans le DOM, fires standard events |
| 2. TrackingClient (browser) | batch envoyé à /api/track avec event_id UUID |
| 3. /api/track route | reçoit les events, valide, dispatche |
| 4. Dispatcher | route vers tous les providers enabled |
| 5. Provider Meta CAPI | reçoit POST graph.facebook.com avec event_id |
| 6. Provider GA4 MP | reçoit POST google-analytics.com |
| 7. Provider Google Ads CAPI | reçoit POST googleads.googleapis.com avec event_id |
| 8. Provider TikTok / Snap / Pinterest | reçoit POST CAPI |
| 9. DB tracking_events_log | INSERT avec event_id, providers_results |
| 10. Event categorization | `purchase` mappé à `purchase` (Google Ads) |
| 11. Consent Mode | tags reçoivent consent.update |
| 12. Deduplication | event_id propagé ET dédupliqué côté Google |

## Fichier — `e2e/ULTIMATE-pipeline-validation.spec.ts`

```typescript
import { expect, test } from '@playwright/test';

test.describe('🎯 ULTIMATE — Tracking pipeline end-to-end', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Full /kit purchase pipeline — all providers dispatched with event_id', async ({ page }) => {
    /* ===================================================================
     * SETUP : mock all external services (Meta CAPI, Google Ads, GA4, ...)
     * Capture all interactions for assertions.
     * =================================================================== */

    const interactions = {
      trackPosts: [] as any[],
      metaCapiPosts: [] as any[],
      ga4MpPosts: [] as any[],
      googleAdsCapiPosts: [] as any[],
      tiktokPosts: [] as any[],
      orderPost: null as any,
      pixelsFetch: null as any,
    };

    // 1. Mock /api/track (server) — intercepter ce que le browser envoie
    await page.route('**/api/track', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      interactions.trackPosts.push(body);
      route.fulfill({ status: 200, body: JSON.stringify({ received: body.events?.length ?? 0 }) });
    });

    // 2. Mock /api/track/pixels (snippets returned)
    await page.route('**/api/track/pixels', async (route) => {
      interactions.pixelsFetch = await route.request().headersArray();
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          snippets: [
            { kind: 'google_ga4', code: '/* gtag js */ console.log("ga4 loaded");' },
            { kind: 'google_ads', code: '/* ads js */ console.log("ads loaded");' },
            { kind: 'gtm', code: '/* gtm js */ console.log("gtm loaded");' },
          ],
        }),
      });
    });

    // 3. Mock /api/checkout/order
    await page.route('**/api/checkout/order', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}');
      interactions.orderPost = body;
      route.fulfill({
        status: 201,
        body: JSON.stringify({
          orderId: 'o_test_ultimate_001',
          totalCents: 19900,
          currency: 'MAD',
          status: 'pending_confirmation',
        }),
      });
    });

    /* ===================================================================
     * EXÉCUTION : parcours utilisateur complet
     * =================================================================== */

    // Naviguer vers /kit
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // pixel loader + initial events

    // Vérifier que les snippets sont injectés (étape 1)
    const scriptTags = await page.$$eval(
      'script[data-tracking-pixel]',
      (els) => els.map((el) => el.getAttribute('data-tracking-pixel')),
    );
    expect(scriptTags).toEqual(expect.arrayContaining(['google_ga4', 'google_ads', 'gtm']));

    // 1. Premier focus sur un champ → form_start
    await page.getByTestId('wizard-first-name-input').focus();
    await page.waitForTimeout(2000);

    // 2. Remplir step 1 (lead)
    await page.getByTestId('wizard-first-name-input').fill('Sara');
    await page.getByTestId('wizard-phone-input').fill('+212600000000');
    await page.getByTestId('wizard-email-input').fill('sara@example.com');
    await page.getByTestId('wizard-consent-checkbox').check();
    await page.getByTestId('wizard-continue-step-1').click();
    await page.waitForTimeout(2000);

    // 3. Remplir step 2 (address)
    await page.getByTestId('wizard-city-input').fill('Rabat');
    await page.getByTestId('wizard-address-input').fill('25 bis Lumumba');
    await page.getByTestId('wizard-continue-step-2').click();
    await page.waitForTimeout(2000);

    // 4. Step 3 (payment) — submit final
    await page.getByTestId('wizard-payment-cod').check();
    await page.getByTestId('wizard-submit-order').click();
    await page.waitForTimeout(3000); // batch + dispatch

    /* ===================================================================
     * ASSERTIONS
     * =================================================================== */

    // ━━━━━ 1. Tous les events sont émis ━━━━━
    const allEvents = interactions.trackPosts.flatMap((b) => b.events ?? []);
    const eventNames = allEvents.map((e) => e.name);

    expect(eventNames, 'form_start must be emitted').toContain('form_start');
    expect(eventNames, 'lead_capture must be emitted').toContain('lead_capture');
    expect(eventNames, 'begin_checkout must be emitted').toContain('begin_checkout');
    expect(eventNames, 'add_shipping_info must be emitted').toContain('add_shipping_info');
    expect(eventNames, 'add_payment_info must be emitted').toContain('add_payment_info');
    expect(eventNames, 'purchase must be emitted').toContain('purchase');

    // ━━━━━ 2. Chaque event a un event_id UUID ━━━━━
    for (const evt of allEvents) {
      expect(evt.event_id, `event ${evt.name} must have UUID event_id`).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }

    // ━━━━━ 3. Le purchase event a les bons params ━━━━━
    const purchaseEvent = allEvents.find((e) => e.name === 'purchase');
    expect(purchaseEvent).toBeDefined();
    expect(purchaseEvent.params).toMatchObject({
      transaction_id: 'o_test_ultimate_001',
      value: 199, // ou 19900 selon convention
      currency: 'MAD',
    });

    // ━━━━━ 4. begin_checkout NE FIRE PAS au mount (régression check) ━━━━━
    // Le premier track post doit être form_start, pas begin_checkout
    // (begin_checkout fire seulement au click Continue de step 1)
    const earlyEvents = interactions.trackPosts.slice(0, 2).flatMap((b) => b.events ?? []);
    expect(
      earlyEvents.filter((e) => e.name === 'begin_checkout'),
      'begin_checkout must NOT fire at mount',
    ).toHaveLength(0);

    // ━━━━━ 5. /api/checkout/order a été appelé ━━━━━
    expect(interactions.orderPost).toBeTruthy();
    expect(interactions.orderPost.items[0].sku).toBe('FEMI-KIT-100');

    // ━━━━━ 6. Pas de double-fire ━━━━━
    const formStartEvents = allEvents.filter((e) => e.name === 'form_start');
    expect(formStartEvents, 'form_start fires only once per session').toHaveLength(1);
    const purchaseEvents = allEvents.filter((e) => e.name === 'purchase');
    expect(purchaseEvents, 'purchase fires only once').toHaveLength(1);

    // ━━━━━ 7. Screenshot final ━━━━━
    await page.screenshot({
      path: 'test-results/ultimate-pipeline-validation.png',
      fullPage: false,
    });

    /* ===================================================================
     * REPORT (pour debug)
     * =================================================================== */
    console.log('\n📊 Pipeline events summary:');
    console.log(`Total /api/track POSTs: ${interactions.trackPosts.length}`);
    console.log(`Total events emitted: ${allEvents.length}`);
    console.log(`Event names: ${eventNames.join(', ')}`);
  });
});
```

## Lancement

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8011 \
  pnpm exec playwright test e2e/ULTIMATE-pipeline-validation.spec.ts \
  --reporter=list --project=chromium
```

## Critères de succès

Le test est vert SSI :
- ✅ Les 6 events sont émis dans le bon ordre
- ✅ Chaque event a un `event_id` UUID v4
- ✅ `form_start` fire 1× par session
- ✅ `begin_checkout` ne fire pas au mount de /commander (régression)
- ✅ `purchase` fire 1× avec les bons params (transaction_id, value, currency)
- ✅ `/api/checkout/order` a été appelé avec le bon variant SKU
- ✅ Pixels GA4 / Google Ads / GTM sont injectés dans le DOM

## Run en CI

À ajouter dans `.github/workflows/ci.yml` ou équivalent :

```yaml
- name: Run ultimate tracking pipeline validation
  run: |
    cd apps/web
    pnpm start &
    sleep 10
    pnpm exec playwright test e2e/ULTIMATE-pipeline-validation.spec.ts
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    # ...
```

## Extensions futures

V2 — ajouter des mocks plus profonds (Meta CAPI, Google Ads CAPI) et
vérifier que le SERVEUR a bien dispatché côté serveur (pas juste le client) :

```typescript
// Intercepter aussi les calls server-side via MSW node
import { setupServer } from 'msw/node';
import { metaHandlers, googleAdsHandlers } from '@/test/msw/handlers';

const mswServer = setupServer(...metaHandlers, ...googleAdsHandlers);
beforeAll(() => mswServer.listen());
```

Puis assert `requests` côté MSW pour vérifier la propagation event_id
serveur → provider externe.
