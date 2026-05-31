# 70.3 — Playwright scenarios (E2E)

## Convention

- 1 fichier par feature (`tracking-*.spec.ts`, `admin-*.spec.ts`)
- Use `test.describe` pour grouper
- `test.use({ viewport: ... })` pour forcer mobile/desktop
- `page.route()` pour mocker les APIs externes (Google Ads, Meta CAPI)
- Screenshots à des points clés pour debug

## Scénarios prioritaires

### TE01 — form_start fires at first focus on /kit

```typescript
// e2e/tracking-form-start.spec.ts
test('form_start fires at first focus on /kit wizard', async ({ page }) => {
  // Intercept /api/track to verify
  const trackEvents: any[] = [];
  await page.route('**/api/track', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    trackEvents.push(...body.events);
    route.fulfill({ status: 200, body: '{"received":' + body.events.length + '}' });
  });

  await page.goto('/kit');
  await page.waitForLoadState('networkidle');

  // No form_start yet (page just loaded)
  expect(trackEvents.filter((e) => e.name === 'form_start')).toHaveLength(0);

  // Focus first field
  await page.getByTestId('wizard-first-name-input').focus();
  await page.waitForTimeout(2000); // batch debounce 1500ms

  // form_start fired
  const formStartEvents = trackEvents.filter((e) => e.name === 'form_start');
  expect(formStartEvents).toHaveLength(1);
  expect(formStartEvents[0]).toMatchObject({
    name: 'form_start',
    params: {
      form_id: 'wizard_kit',
      first_field: 'firstName',
    },
  });
  // event_id is UUID
  expect(formStartEvents[0].event_id).toMatch(/^[0-9a-f-]{36}$/);

  // Focus second field — should NOT re-fire
  await page.getByTestId('wizard-phone-input').focus();
  await page.waitForTimeout(2000);
  expect(trackEvents.filter((e) => e.name === 'form_start')).toHaveLength(1);
});
```

### TE03 — begin_checkout NOT at page mount

```typescript
test('begin_checkout fires only on Continue click, not at page mount', async ({ page }) => {
  const trackEvents: any[] = [];
  await page.route('**/api/track', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    trackEvents.push(...body.events);
    route.fulfill({ status: 200, body: '{"received":' + body.events.length + '}' });
  });

  await page.goto('/commander');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2500); // batch debounce

  // No begin_checkout at mount
  expect(trackEvents.filter((e) => e.name === 'begin_checkout')).toHaveLength(0);

  // Fill step 1 and click Continue
  await page.getByTestId('wizard-first-name-input').fill('Sara');
  await page.getByTestId('wizard-phone-input').fill('+212600000000');
  await page.getByTestId('wizard-consent-checkbox').check();
  await page.getByTestId('wizard-continue-step-1').click();

  await page.waitForTimeout(2500);

  // begin_checkout fired now
  expect(trackEvents.filter((e) => e.name === 'begin_checkout')).toHaveLength(1);
});
```

### TE04 — Purchase pipeline complete

```typescript
test('full /kit purchase pipeline emits 5 events with event_id', async ({ page }) => {
  const trackEvents: any[] = [];
  await page.route('**/api/track', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    trackEvents.push(...body.events);
    route.fulfill({ status: 200, body: '{"received":' + body.events.length + '}' });
  });
  // Mock /api/checkout/order
  await page.route('**/api/checkout/order', (route) => {
    route.fulfill({ status: 201, body: JSON.stringify({
      orderId: 'o_test_123',
      totalCents: 19900,
      currency: 'MAD',
      status: 'pending_confirmation',
    })});
  });

  await page.goto('/kit');
  await page.waitForLoadState('networkidle');

  // Step 0 — Lead
  await page.getByTestId('wizard-first-name-input').focus(); // form_start
  await page.getByTestId('wizard-first-name-input').fill('Sara');
  await page.getByTestId('wizard-phone-input').fill('+212600000000');
  await page.getByTestId('wizard-consent-checkbox').check();
  await page.getByTestId('wizard-continue-step-1').click(); // lead_capture + begin_checkout

  // Step 1 — Address
  await page.getByTestId('wizard-city-input').fill('Rabat');
  await page.getByTestId('wizard-address-input').fill('25 bis Lumumba');
  await page.getByTestId('wizard-continue-step-2').click(); // add_shipping_info

  // Step 2 — Payment
  await page.getByTestId('wizard-payment-cod').check();
  await page.getByTestId('wizard-submit-order').click(); // add_payment_info + purchase

  await page.waitForTimeout(3000);

  // Vérifier les 6 events
  const eventNames = trackEvents.map((e) => e.name);
  expect(eventNames).toContain('form_start');
  expect(eventNames).toContain('lead_capture');
  expect(eventNames).toContain('begin_checkout');
  expect(eventNames).toContain('add_shipping_info');
  expect(eventNames).toContain('add_payment_info');
  expect(eventNames).toContain('purchase');

  // event_id présent sur chaque event
  for (const evt of trackEvents) {
    expect(evt.event_id).toMatch(/^[0-9a-f-]{36}$/);
  }
});
```

### TE05 — GTM create wizard

```typescript
test('Create GTM version wizard end to end', async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto('/admin/tracking/gtm');
  await page.getByRole('button', { name: /Nouvelle version/i }).click();

  // Step 1 — Source
  await page.getByLabel(/Providers actuels/i).check();
  await page.getByRole('button', { name: /Continuer/i }).click();

  // Step 2 — Naming
  await page.getByLabel(/Nom de la version/i).fill('Test e2e version');
  await page.getByRole('button', { name: /Suivant/i }).click();

  // Step 3 — Production (pré-rempli depuis Providers)
  // Vérifier que Meta Pixel ID est pré-rempli
  const metaPixelInput = page.getByLabel('Meta Pixel ID');
  await expect(metaPixelInput).not.toHaveValue('');

  // ... continuer wizard

  // Final — création
  await page.getByRole('button', { name: /Créer la version/i }).click();
  await page.waitForURL(/\/admin\/tracking\/gtm/);

  // Vérifier que la version est dans la liste
  await expect(page.getByText('Test e2e version')).toBeVisible();
});
```

### TE07 — Override categorization

```typescript
test('Override Google Ads category for an event', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/tracking/events/categorization');

  const row = page.locator('tr').filter({ hasText: 'stock_notify_subscribe' });
  const dropdown = row.locator('select');

  // Initial : default (None)
  await expect(dropdown).toHaveValue('');

  // Change to Lead
  await dropdown.selectOption('lead');

  // Toast de confirmation
  await expect(page.getByText(/Catégorie mise à jour/i)).toBeVisible();

  // Reload page → persistence
  await page.reload();
  await expect(row.locator('select')).toHaveValue('lead');
  await expect(row.getByText(/override/i)).toBeVisible();
});
```

### TE10 — A11y axe-core

```typescript
import AxeBuilder from '@axe-core/playwright';

test('Tracking admin pages — axe-core no critical violations', async ({ page }) => {
  await loginAsAdmin(page);

  const urls = [
    '/admin/tracking',
    '/admin/tracking/gtm',
    '/admin/tracking/events/categorization',
    '/admin/tracking/analytics/providers',
  ];

  for (const url of urls) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, `Critical a11y issues on ${url}`).toHaveLength(0);
  }
});
```

## Fixtures

Centralisées dans `e2e/fixtures/`:
- `admin-auth.ts` — login helper
- `tracking-routes.ts` — mocks pour /api/track, /api/checkout/*
- `gtm-versions.ts` — versions exemples
- `event-fixtures.ts` — events typés

## Run

```bash
# Tous les tests
pnpm exec playwright test

# Un seul fichier
pnpm exec playwright test e2e/tracking-form-start.spec.ts

# Avec UI (debug)
pnpm exec playwright test --ui

# Mobile uniquement
pnpm exec playwright test --project=chromium-mobile
```
