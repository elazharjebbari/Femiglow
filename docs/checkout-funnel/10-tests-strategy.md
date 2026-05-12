# Stratégie de tests — atomique par composant

> Stack : Vitest 2 (unit) + React Testing Library + MSW 2 + Playwright 1.48
> + axe-core + Lighthouse-CI. Coverage cible globale : 80 %.
>
> Cette doc décrit **chaque scénario à coder**, pas seulement les principes.

---

## Sommaire

1. [Pyramide & stack](#1-pyramide--stack)
2. [Conventions](#2-conventions)
3. [Tests unitaires Vitest](#3-tests-unitaires-vitest)
4. [Tests d'intégration RTL + MSW](#4-tests-dintégration-rtl--msw)
5. [Tests E2E Playwright](#5-tests-e2e-playwright)
6. [Tests a11y](#6-tests-a11y)
7. [Tests de performance](#7-tests-de-performance)
8. [Tests visuels](#8-tests-visuels)
9. [CI gates](#9-ci-gates)
10. [Factories & utilities](#10-factories--utilities)

---

## 1. Pyramide & stack

```
                            ┌───────────────────┐
                            │  Playwright E2E   │   ~15 scénarios
                            │  (browser réel)   │
                            └───────────────────┘
                       ┌────────────────────────────┐
                       │  RTL + MSW integration     │   ~60 scénarios
                       │  (composant + serveur fake)│
                       └────────────────────────────┘
                ┌──────────────────────────────────────┐
                │  Vitest unit (fonctions pures)       │   ~120 scénarios
                │  Zod, repos avec DB mockée, builders │
                └──────────────────────────────────────┘
```

**Pourquoi MSW** : déjà installé (`apps/web/src/test/msw/`), permet de simuler les API serveur sans tourner le backend, idéal pour tester le wizard côté client avec des réponses contrôlées.

---

## 2. Conventions

### 2.1 Localisation des tests

| Type | Path |
|---|---|
| Unit fonctions pures | `apps/web/src/**/__tests__/*.spec.ts` (collocalisé) |
| Component unit (RTL+MSW) | `apps/web/src/components/**/__tests__/*.spec.tsx` |
| API route handler | `apps/web/src/app/api/**/__tests__/route.spec.ts` |
| Server actions | `apps/web/src/lib/**/actions/__tests__/*.spec.ts` |
| E2E | `apps/web/e2e/*.spec.ts` |
| a11y | `apps/web/e2e/a11y/*.spec.ts` |
| Visual | `apps/web/e2e/visual/*.spec.ts` |

### 2.2 Nommage

```ts
describe('PhoneInput', () => {
  describe('formatting', () => {
    it('formats 612345678 as "6 12 34 56 78"', () => {});
    it('caps input at 9 digits', () => {});
  });

  describe('validation', () => {
    it('shows error on blur if invalid', () => {});
    it('clears error when user fixes input', () => {});
  });
});
```

### 2.3 Setup minimal

```ts
// apps/web/src/test/setup.ts (déjà existant, étendre si besoin)

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

### 2.4 Pattern factories (pas de Faker)

```ts
// apps/web/src/test/factories/lead.ts (nouveau)

export function buildLead(overrides: Partial<ChatLead> = {}): ChatLead {
  return {
    id: 'lead_test_001',
    firstName: 'Sara',
    lastName: null,
    email: null,
    phone: '612345678',
    source: 'wizard_lead_step',
    cartSnapshot: null,
    address: null,
    paymentMethod: null,
    promoCode: null,
    consentedAt: null,
    status: 'new',
    gclid: null,
    fbclid: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    createdAt: new Date('2026-05-11T10:00:00Z'),
    updatedAt: new Date('2026-05-11T10:00:00Z'),
    ...overrides,
  };
}

export function buildFormConfig(overrides = {}): FormConfigRow {
  return {
    id: 'cfg_test_001',
    slug: 'checkout_wizard',
    version: 1,
    status: 'published',
    name: 'Test Config',
    description: null,
    config: DEFAULT_FORM_CONFIG_JSON,
    variantAssignment: null,
    publishedAt: new Date(),
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    ...overrides,
  };
}
```

---

## 3. Tests unitaires Vitest

### 3.1 Schemas Zod — `apps/web/src/lib/checkout/schemas/__tests__/lead.spec.ts`

```ts
describe('createLeadInputSchema', () => {
  it('accepts minimal valid input', () => {
    const result = createLeadInputSchema.safeParse({
      firstName: 'Sara',
      phone: '612345678',
      source: 'wizard_lead_step',
    });
    expect(result.success).toBe(true);
  });

  it('rejects firstName < 2 chars', () => {
    const result = createLeadInputSchema.safeParse({
      firstName: 'S',
      phone: '612345678',
      source: 'wizard_lead_step',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['firstName']);
  });

  it('rejects phone not starting with 6 or 7', () => { /* ... */ });
  it('rejects phone with non-digits', () => { /* ... */ });
  it('rejects phone < 9 digits', () => { /* ... */ });
  it('accepts email if valid', () => { /* ... */ });
  it('rejects email if invalid', () => { /* ... */ });
  it('rejects unknown source enum', () => { /* ... */ });
  it('accepts optional tracking with all utm fields', () => { /* ... */ });
});

describe('patchLeadInputSchema', () => {
  it('accepts empty body', () => { /* ... */ });
  it('accepts address only', () => { /* ... */ });
  it('rejects address line1 < 5 chars', () => { /* ... */ });
  it('rejects city without cityId', () => { /* ... */ });
  it('rejects postalCode non 5-digit', () => { /* ... */ });
  it('accepts paymentMethod cod|bank', () => { /* ... */ });
  it('rejects paymentMethod unknown', () => { /* ... */ });
  it('accepts consentedAt ISO datetime', () => { /* ... */ });
  it('rejects consentedAt non-ISO', () => { /* ... */ });
});

describe('formConfigJsonSchema', () => {
  it('accepts default config', () => { /* ... */ });
  it('rejects missing $schema field', () => { /* ... */ });
  it('rejects wrong $schema version', () => { /* ... */ });
  it('rejects step "lead" disabled', () => { /* superRefine business rule */ });
  it('rejects step "payment" disabled', () => { /* ... */ });
  it('rejects phone field disabled or not required', () => { /* ... */ });
  it('rejects paymentMethod field disabled or not required', () => { /* ... */ });
  it('rejects more than 5 steps', () => { /* ... */ });
  it('rejects more than 20 fields per step', () => { /* ... */ });
});
```

**Cas total Zod : ~25.**

### 3.2 Fonctions pures — variant assignment

```ts
// apps/web/src/lib/checkout/form-config/__tests__/variant-assignment.spec.ts

describe('assignVariant', () => {
  const variants = [
    { key: 'control', weight: 50 },
    { key: 'B', weight: 50 },
  ];

  it('returns "control" for seed hashing to bucket < 50', () => {
    const seed = 'deterministic-seed-1';
    const { variantKey } = assignVariant(variants, seed);
    expect(['control', 'B']).toContain(variantKey);
    // Deterministic: même seed → même result
    const second = assignVariant(variants, seed);
    expect(second.variantKey).toBe(variantKey);
  });

  it('distributes ~50/50 over 1000 random seeds', () => {
    const counts = { control: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const { variantKey } = assignVariant(variants, `seed-${i}`);
      counts[variantKey]++;
    }
    expect(counts.control).toBeGreaterThan(400);
    expect(counts.control).toBeLessThan(600);
  });

  it('falls back to control if weights sum < 100', () => { /* ... */ });
  it('applies overrides from selected variant', () => { /* ... */ });
});
```

### 3.3 Phone formatting

```ts
// apps/web/src/components/commerce/wizard/utils/__tests__/normalizePhoneInput.spec.ts

describe('formatPhone', () => {
  it('formats empty', () => expect(formatPhone('')).toBe(''));
  it('formats 1 digit', () => expect(formatPhone('6')).toBe('6'));
  it('formats 3 digits', () => expect(formatPhone('612')).toBe('6 12'));
  it('formats 5 digits', () => expect(formatPhone('61234')).toBe('6 12 34'));
  it('formats 9 digits', () => expect(formatPhone('612345678')).toBe('6 12 34 56 78'));
  it('handles 7 prefix', () => expect(formatPhone('712345678')).toBe('7 12 34 56 78'));
});
```

### 3.4 City search Fuse.js

```ts
// apps/web/src/lib/geo/__tests__/city-search.spec.ts

describe('searchCity', () => {
  it('finds "Casablanca" by exact match', () => {
    const results = searchCity('Casablanca', 'fr');
    expect(results[0].name).toBe('Casablanca');
  });

  it('finds "Casablanca" by lowercase "casa"', () => { /* ... */ });
  it('finds "Casablanca" by typo "casablance"', () => { /* ... */ });
  it('finds "Marrakech" by ASCII "marrakech"', () => { /* ... */ });
  it('finds "Sefrou" without accent', () => { /* ... */ });
  it('finds "الدار البيضاء" by AR exact', () => { /* ... */ });
  it('returns empty for nonsense', () => { /* ... */ });
  it('returns top 7 results max', () => { /* ... */ });
});
```

### 3.5 GTM builders

```ts
// apps/web/src/lib/tracking/gtm/__tests__/builders.spec.ts

describe('buildLeadCaptureEvent', () => {
  it('produces correct event shape', () => {
    const event = buildLeadCaptureEvent({
      leadId: 'lead_123',
      formMode: 'wizard_embed',
      variantKey: 'control',
    });
    expect(event).toEqual({
      event: 'lead_capture',
      lead_id: 'lead_123',
      form_mode: 'wizard_embed',
      variant_key: 'control',
      step_name: 'lead',
    });
  });

  it('omits variantKey if not provided', () => { /* ... */ });
});

describe('buildPurchaseEvent', () => {
  it('matches GTM Import/Export taxonomy UPPER_SNAKE_CASE', () => { /* ... */ });
  it('includes all required GA4 ecommerce fields', () => { /* ... */ });
  it('attaches form_mode and variant_key', () => { /* ... */ });
});

// ... 8+ builders × 2-3 cas chacun
```

---

## 4. Tests d'intégration RTL + MSW

### 4.1 MSW handlers à créer

```ts
// apps/web/src/test/msw/handlers/checkout-lead.ts (nouveau)

import { http, HttpResponse } from 'msw';

export const checkoutLeadHandlers = [
  http.post('/api/checkout/lead', async ({ request }) => {
    const body = await request.json();
    if (body.firstName?.length < 2) {
      return HttpResponse.json(
        { errors: [{ field: 'firstName', message: 'Minimum 2 caractères' }] },
        { status: 422 }
      );
    }
    return HttpResponse.json({
      leadId: 'lead_test_001',
      variantKey: 'control',
      formConfig: buildDefaultFormConfig(),
    }, { status: 201 });
  }),

  http.patch('/api/checkout/lead/:leadId', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      leadId: params.leadId,
      status: 'in_progress',
      updatedFields: Object.keys(body),
    });
  }),

  http.post('/api/checkout/lead/:leadId/finalize', async () => {
    return HttpResponse.json({
      orderId: 'ord_test_001',
      orderNumber: 'FG-TEST01',
      redirectTo: '/merci/ord_test_001',
      total: 29,
      currency: 'EUR',
    }, { status: 201 });
  }),

  http.get('/api/checkout/form-config/active', () => {
    return HttpResponse.json({
      id: 'cfg_test_001',
      version: 1,
      config: buildDefaultFormConfig(),
      publishedAt: new Date().toISOString(),
    });
  }),
];
```

Server :
```ts
// apps/web/src/test/msw/server.ts (existant, ajouter handlers)
import { setupServer } from 'msw/node';
import { checkoutLeadHandlers } from './handlers/checkout-lead';
import { adminFormConfigHandlers } from './handlers/admin-form-config';

export const server = setupServer(
  ...checkoutLeadHandlers,
  ...adminFormConfigHandlers,
  // ... handlers existants
);
```

### 4.2 `<Step1Lead>` — 7 scénarios

```tsx
// apps/web/src/components/commerce/wizard/steps/__tests__/Step1Lead.spec.tsx

import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { Step1Lead } from '../Step1Lead';

describe('<Step1Lead />', () => {
  const setup = () => {
    const onSubmit = vi.fn();
    render(
      <WizardProvider initialState={{ formConfig: buildDefaultFormConfig(), currentStep: 'lead' }}>
        <Step1Lead onSubmit={onSubmit} />
      </WizardProvider>
    );
    return { onSubmit, user: userEvent.setup() };
  };

  it('1.1 renders firstName + phone fields with labels', () => {
    setup();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
  });

  it('1.2 disables CTA when form invalid', () => {
    setup();
    expect(screen.getByRole('button', { name: /continuer/i })).toBeDisabled();
  });

  it('1.3 enables CTA when both fields filled with valid values', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/prénom/i), 'Sara');
    await user.type(screen.getByLabelText(/téléphone/i), '612345678');
    await user.tab();  // blur
    expect(await screen.findByRole('button', { name: /continuer/i })).toBeEnabled();
  });

  it('1.4 shows error if phone invalid on blur', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/téléphone/i), '512345678');  // starts with 5
    await user.tab();
    expect(await screen.findByText(/numéro marocain invalide/i)).toBeInTheDocument();
  });

  it('1.5 calls POST /api/checkout/lead on submit', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText(/prénom/i), 'Sara');
    await user.type(screen.getByLabelText(/téléphone/i), '612345678');
    await user.tab();
    await user.click(screen.getByRole('button', { name: /continuer/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead_test_001',
    })));
  });

  it('1.6 displays loading state during submit', async () => {
    server.use(http.post('/api/checkout/lead', async () => {
      await new Promise(r => setTimeout(r, 200));
      return HttpResponse.json({ leadId: 'lead_x', variantKey: 'control', formConfig: {} });
    }));
    const { user } = setup();
    await user.type(screen.getByLabelText(/prénom/i), 'Sara');
    await user.type(screen.getByLabelText(/téléphone/i), '612345678');
    await user.click(screen.getByRole('button', { name: /continuer/i }));
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('1.7 displays toast on network error and offers retry', async () => {
    server.use(http.post('/api/checkout/lead', () => HttpResponse.error()));
    const { user } = setup();
    await user.type(screen.getByLabelText(/prénom/i), 'Sara');
    await user.type(screen.getByLabelText(/téléphone/i), '612345678');
    await user.click(screen.getByRole('button', { name: /continuer/i }));
    expect(await screen.findByText(/erreur réseau/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
  });
});
```

### 4.3 `<Step2Address>` — 10 scénarios

```tsx
describe('<Step2Address />', () => {
  it('2.1 renders <StockIndicator> on top + city combobox + address + postal + landmark fields');
  it('2.2 city combobox opens on focus and shows top suggestions');
  it('2.3 city combobox filters as user types ("casa" → Casablanca first)');
  it('2.4 keyboard nav ↑↓ Enter on combobox selects city');
  it('2.5 selecting city auto-fills postalCode if known');
  it('2.6 calls PATCH /api/checkout/lead/[id] debounced on valid address');
  it('2.7 CTA enabled only when city + address filled');
  it('2.8 "Étape précédente" link navigates back to step 1');
  it('2.9 RTL: combobox popover aligns right when dir=rtl');
  it('2.10 out_of_stock state disables CTA and renders <StockNotifyOptIn>');
});
```

### 4.3.b `<StockIndicator>` — 8 scénarios

```tsx
describe('<StockIndicator />', () => {
  it('s.1 in_stock state: green CheckCircle2 icon + "Expédition sous 24-48h"');
  it('s.2 low_stock state: amber AlertTriangle + "Plus que {n} kits" + pulse animation');
  it('s.3 low_stock state: respects prefers-reduced-motion → no pulse');
  it('s.4 restocking state: blue Clock + "Réappro sous {days} jours"');
  it('s.5 out_of_stock state: red XCircle + email notify opt-in inline');
  it('s.6 fires GTM stock_indicator_view event on mount with {state, units, threshold}');
  it('s.7 RTL: copy renders RTL with logical properties');
  it('s.8 fetches /api/checkout/stock/[productId] with cache tag product-stock-{id}');
});
```

### 4.4 `<Step3Payment>` — 8 scénarios

```tsx
describe('<Step3Payment />', () => {
  it('3.1 renders 2 payment options (COD, Bank) with COD pre-selected');
  it('3.2 selecting different option updates store');
  it('3.3 promo code field accepts code and shows "Appliquer" button');
  it('3.4 invalid promo shows error message');
  it('3.5 valid promo updates total with strikethrough on old price');
  it('3.6 renders consent disclaimer micro-copy under CTA with links to /legal/cgv and /legal/privacy');
  it('3.7 submitting calls POST /finalize (server sets consented_at) and redirects on success');
  it('3.8 server 409 (idempotency conflict) redirects to /merci/[id]');
  it('3.9 server 409 stock_unavailable shows stock-error toast');
});
```

### 4.4.b `<ThankYouEmailOptIn>` — 6 scénarios

```tsx
describe('<ThankYouEmailOptIn />', () => {
  it('t.1 renders form with email input + optional label + CTA "M\'envoyer la confirmation"');
  it('t.2 invalid email shows inline error on blur, CTA stays clickable but does not submit');
  it('t.3 valid email submit → PATCH /api/checkout/order/[id]/email with Idempotency-Key + transitions to success state');
  it('t.4 success state replaces form with check icon + "Confirmation envoyée à {email}"');
  it('t.5 server 429 RATE_LIMITED → shows error message and CTA stays disabled for 600s');
  it('t.6 server 502 EMAIL_PROVIDER_UNAVAILABLE → shows error + allows retry with same Idempotency-Key');
});
```

### 4.5 `<WizardCombobox>` — 8 scénarios

```tsx
describe('<WizardCombobox />', () => {
  it('renders trigger button with placeholder');
  it('opens popover on click');
  it('opens popover on focus + Arrow Down key');
  it('filters items via Fuse.js with threshold 0.3');
  it('highlights item on hover');
  it('highlights item via ↑↓ keys');
  it('selects item on Enter');
  it('closes on Escape and returns focus to input');
});
```

### 4.6 `<PhoneInput>` — 6 scénarios

```tsx
describe('<PhoneInput />', () => {
  it('renders +212 prefix as readonly');
  it('accepts only numeric input');
  it('formats live: 612 → "6 12"');
  it('caps at 9 digits');
  it('strips spaces from value passed to onChange');
  it('isolates +212 with bdi for RTL safety');
});
```

### 4.7 `<WizardProgress>` — 4 scénarios

```tsx
describe('<WizardProgress />', () => {
  it('renders 4 step indicators');
  it('marks active step as filled');
  it('marks completed steps with checkmark');
  it('uses aria-current="step" on active');
});
```

### 4.8 Admin `<FormConfigEditor>` — 8 scénarios

```tsx
describe('<FormConfigEditor />', () => {
  it('renders 5 tabs (Champs, Logique, Variantes, Aperçu, Historique)');
  it('shows current config fields in "Champs" tab');
  it('allows toggling field enabled/disabled');
  it('locks fields phone/paymentMethod (disabled toggles)');
  it('reorders fields via drag-drop');
  it('autosaves changes debounced 1500ms');
  it('publishes config via "Publier" button + confirm modal');
  it('shows audit history with JSON Patch diff in "Historique" tab');
});
```

### 4.9 API route handlers — 11 scénarios

```ts
// apps/web/src/app/api/checkout/lead/__tests__/route.spec.ts

describe('POST /api/checkout/lead', () => {
  it('a.1 creates lead with valid input (201)');
  it('a.2 returns 422 on invalid phone');
  it('a.3 returns 422 on missing firstName');
  it('a.4 returns 429 if rate limited');
  it('a.5 returns cached response on duplicate idempotency-key');
  it('a.6 assigns variant deterministically');
  it('a.7 sets fg_lead cookie httpOnly secure');
});

describe('PATCH /api/checkout/lead/[id]', () => {
  it('b.1 patches address with valid payload (200)');
  it('b.2 rejects if cookie fg_lead != [id] (403)');
  it('b.3 rejects unknown leadId (404)');
});

describe('POST /api/checkout/lead/[id]/finalize', () => {
  it('c.1 creates order with valid lead (201)');
  it('c.2 returns 409 on expectedTotal mismatch');
  it('c.3 returns 422 if missing required fields (firstName/phone/address/paymentMethod)');
  it('c.3b auto-sets chat_lead.consented_at + consent_version + ip on finalize (audit trail)');
  it('c.4 idempotent: same key → same orderId');
  it('c.5 returns 409 stock_unavailable if product_stock.stock_units < quantity');
  it('c.6 decrements product_stock.stock_units atomically in same transaction');
});

describe('GET /api/checkout/stock/[productId]', () => {
  it('d.1 returns 200 with state=in_stock when stockUnits > threshold');
  it('d.2 returns 200 with state=low_stock when 0 < stockUnits ≤ threshold');
  it('d.3 returns 200 with state=restocking when stockUnits=0 + restockEtaDays!=null');
  it('d.4 returns 200 with state=out_of_stock when stockUnits=0 + restockEtaDays=null');
  it('d.5 returns 404 for unknown productId');
  it('d.6 cached with tag product-stock-{productId} (60s)');
});

describe('PATCH /api/admin/products/stock/[id]', () => {
  it('e.1 requires admin auth (401 if not authenticated)');
  it('e.2 requires editor/owner role (403 if viewer)');
  it('e.3 updates stockUnits + writes product_stock_adjustment audit row');
  it('e.4 rejects negative stockUnits (422)');
  it('e.5 rejects empty reason (422 — reason min 5 chars)');
  it('e.6 triggers revalidateTag(product-stock-{productId}) on success');
});

describe('POST /api/checkout/stock-notify', () => {
  it('f.1 creates stock_notify_optin row with valid email');
  it('f.2 dedupes by productId + email (idempotent)');
  it('f.3 returns 429 if rate limited (5/min/IP)');
});

describe('PATCH /api/checkout/order/[orderId]/email', () => {
  it('g.1 returns 200 with valid email + dispatches transactional template');
  it('g.2 returns 400 INVALID_EMAIL on bad format');
  it('g.3 returns 404 ORDER_NOT_FOUND on unknown orderId');
  it('g.4 returns 429 RATE_LIMITED after 3 attempts within 10 min');
  it('g.5 returns 200 idempotent re-send when same Idempotency-Key + same email');
  it('g.6 returns 502 EMAIL_PROVIDER_UNAVAILABLE on provider error (retry-safe)');
  it('g.7 increments email_optin_attempts on each request');
});
```

---

## 5. Tests E2E Playwright

### 5.1 Setup auth admin (existant)

```ts
// apps/web/playwright.config.ts (déjà setup project)
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  {
    name: 'chromium',
    dependencies: ['setup'],
    use: { ...devices['Desktop Chrome'], storageState: 'apps/web/.playwright/auth/admin.json' },
  },
  // ...
],
```

### 5.2 Scénario E2E.1 — Happy path wizard (Mode B)

```ts
// apps/web/e2e/wizard-happy-path.spec.ts

test('Mode B: wizard happy path FR end-to-end', async ({ page }) => {
  // Préparer panier
  await page.goto('/fr/kit');
  await page.click('button:has-text("Ajouter au panier")');
  await page.goto('/fr/commander');

  // Step 1
  await expect(page.getByRole('heading', { name: /recevez votre kit/i })).toBeVisible();
  await page.fill('input[name="firstName"]', 'Sara');
  await page.fill('input[name="phone"]', '612345678');
  await page.click('button:has-text("Continuer")');

  // Step 2
  await expect(page.getByRole('heading', { name: /où devons-nous livrer/i })).toBeVisible();
  await page.click('input[name="city"]');
  await page.type('input[name="city"]', 'casa');
  await page.click('li:has-text("Casablanca")');
  await page.fill('input[name="address"]', '12 rue de la paix, apt 5');
  await page.click('button:has-text("Continuer")');

  // Step 3
  await expect(page.getByRole('heading', { name: /comment souhaitez-vous payer/i })).toBeVisible();
  await page.click('label:has-text("À la livraison")');
  // No consent checkbox — consent is implicit at submit (disclaimer under CTA)
  await page.click('button:has-text("Confirmer ma commande")');

  // Step 4
  await expect(page).toHaveURL(/\/merci\/ord_/);
  await expect(page.getByText(/merci sara/i)).toBeVisible();
});
```

### 5.3 Scénario E2E.2 — RTL Arabic

```ts
test('Mode B: wizard happy path AR (RTL)', async ({ page }) => {
  await page.goto('/ar/kit');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // ... same flow with AR text
});
```

### 5.4 Scénario E2E.3 — Mode A embed mobile

```ts
test('Mode A: kit embed wizard mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/fr/kit');
  await page.click('button:has-text("Commander en 30s")');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  // ... complete flow
});
```

### 5.5 Scénario E2E.4 — Resume after abandon

```ts
test('reprise du wizard après abandon', async ({ page, context }) => {
  await page.goto('/fr/commander');
  await page.fill('input[name="firstName"]', 'Sara');
  await page.fill('input[name="phone"]', '612345678');
  await page.click('button:has-text("Continuer")');

  // Close and reopen
  await page.close();
  const newPage = await context.newPage();
  await newPage.goto('/fr/commander');

  // Should resume at Step 2 (lead already created)
  await expect(newPage.getByRole('heading', { name: /où devons-nous livrer/i })).toBeVisible();
});
```

### 5.6 Scénario E2E.5 — Validation errors

```ts
test('shows validation errors and prevents submission', async ({ page }) => {
  await page.goto('/fr/commander');
  await page.fill('input[name="firstName"]', 'S');
  await page.click('input[name="phone"]');  // blur firstName
  await expect(page.getByText(/minimum 2 caractères/i)).toBeVisible();
  await page.fill('input[name="phone"]', '512');
  await page.click('input[name="firstName"]');
  await expect(page.getByText(/numéro marocain invalide/i)).toBeVisible();
});
```

### 5.7 Scénario E2E.6 — Admin form config CRUD

```ts
// apps/web/e2e/admin/form-config.spec.ts

test('admin can publish a new form config version', async ({ page }) => {
  await page.goto('/admin/checkout/forms');
  await page.click('button:has-text("+ Nouveau formulaire")');
  await page.fill('input[name="name"]', 'Test v2');
  await page.click('button:has-text("Créer")');

  // Editor
  await page.click('[role="tab"]:has-text("Champs")');
  await page.click('button[aria-label="Désactiver le champ email"]');
  await page.click('button:has-text("Publier")');
  await page.click('button:has-text("Confirmer")');

  // Verify
  await page.goto('/admin/checkout/forms');
  await expect(page.locator('.form-config-card:has-text("Test v2")').locator('.status-badge')).toContainText(/published/i);
});
```

### 5.8 Scénario E2E.7 — A/B variant assignment

```ts
test('variant assignment is sticky per cookie', async ({ page, context }) => {
  await page.goto('/fr/commander');
  const variantKey1 = await page.evaluate(() => window.__variantKey);

  await page.close();
  const newPage = await context.newPage();
  await newPage.goto('/fr/commander');
  const variantKey2 = await newPage.evaluate(() => window.__variantKey);

  expect(variantKey1).toBe(variantKey2);
});
```

### 5.9 Scénario E2E.8 — GTM events

```ts
test('GTM events are pushed in correct sequence', async ({ page }) => {
  const events: any[] = [];
  await page.exposeFunction('__captureEvent', (e: any) => events.push(e));
  await page.addInitScript(() => {
    window.dataLayer = window.dataLayer || [];
    const origPush = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = (...args: any[]) => {
      args.forEach(a => (window as any).__captureEvent(a));
      return origPush(...args);
    };
  });
  // run happy path
  // ...
  expect(events.map(e => e.event)).toEqual([
    'view_kit',
    'add_to_cart',
    'begin_checkout',
    'lead_capture',
    'address_completed',
    'add_payment_info',
    'purchase',
  ]);
});
```

### 5.10 Scénario E2E.9-15 — Variants & edge cases

- E2E.9 : COD vs Card flows
- E2E.10 : Promo code valid + invalid
- E2E.11 : Cart empty → redirect / message
- E2E.12 : Network offline mid-flow
- E2E.13 : Admin rollback flow
- E2E.14 : Lottie animation plays on thank-you
- E2E.15 : LocaleSwitcher mid-flow preserves state

---

## 6. Tests a11y

### 6.1 axe-core en Playwright

```ts
// apps/web/e2e/a11y/wizard-a11y.spec.ts

import AxeBuilder from '@axe-core/playwright';

test.describe('wizard a11y', () => {
  test('Step 1 has no critical/serious violations', async ({ page }) => {
    await page.goto('/fr/commander');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact!));
    expect(critical).toEqual([]);
  });

  test('Step 2 (with combobox open) has no violations', async ({ page }) => { /* ... */ });
  test('Step 3 has no violations', async ({ page }) => { /* ... */ });
  test('Step 4 (thank-you) has no violations', async ({ page }) => { /* ... */ });
  test('Admin /admin/checkout/forms has no violations', async ({ page }) => { /* ... */ });
  test('RTL AR variant has no violations', async ({ page }) => { /* ... */ });
});
```

### 6.2 Focus management

```ts
test('focus moves to step heading on transition', async ({ page }) => {
  await page.goto('/fr/commander');
  await page.fill('[name="firstName"]', 'Sara');
  await page.fill('[name="phone"]', '612345678');
  await page.click('button:has-text("Continuer")');
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  expect(focused).toMatch(/où devons-nous livrer/i);
});

test('focus moves to first invalid field on submit error', async ({ page }) => { /* ... */ });
test('focus trap works in mobile drawer', async ({ page }) => { /* ... */ });
```

### 6.3 Keyboard nav

```ts
test('Tab navigation respects natural order', async ({ page }) => { /* ... */ });
test('Esc closes mobile drawer with confirm', async ({ page }) => { /* ... */ });
```

---

## 7. Tests de performance

### 7.1 Lighthouse CI

```ts
// apps/web/lighthouserc.json (à créer si absent)
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/fr/kit",
        "http://localhost:3000/fr/commander",
        "http://localhost:3000/fr/merci/test"
      ],
      "settings": { "preset": "desktop" },
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.88 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

### 7.2 Bundle size CI

```bash
# .github/workflows/ci.yml
- name: Check bundle size
  run: |
    cd apps/web
    bun run build
    bun run check:bundle-size  # custom script avec budgets
```

### 7.3 Playwright perf trace

```ts
test('wizard transition < 350ms', async ({ page }) => {
  await page.goto('/fr/commander');
  await page.fill('[name="firstName"]', 'Sara');
  await page.fill('[name="phone"]', '612345678');

  const start = Date.now();
  await page.click('button:has-text("Continuer")');
  await page.waitForSelector('h2:has-text("Où devons-nous livrer")');
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(800);  // 350ms anim + 200ms API
});
```

---

## 8. Tests visuels

### 8.1 Playwright snapshots

```ts
// apps/web/e2e/visual/wizard-snapshots.spec.ts

test('Step 1 mobile snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/fr/commander');
  await expect(page).toHaveScreenshot('step1-mobile-fr.png', {
    maxDiffPixelRatio: 0.02,
    fullPage: true,
  });
});

test('Step 1 desktop snapshot', async ({ page }) => { /* ... */ });
test('Step 2 desktop snapshot', async ({ page }) => { /* ... */ });
test('Step 3 desktop snapshot', async ({ page }) => { /* ... */ });
test('Step 4 desktop snapshot', async ({ page }) => { /* ... */ });

test('Step 1 RTL AR snapshot', async ({ page }) => {
  await page.goto('/ar/commander');
  await expect(page).toHaveScreenshot('step1-rtl-ar.png');
});

test('Mode A embed drawer mobile', async ({ page }) => { /* ... */ });
test('Mode A embed sidebar desktop', async ({ page }) => { /* ... */ });
```

### 8.2 Storybook (optionnel V2)

Pas en V1 (overhead setup). Si besoin V2, ajouter Storybook + Chromatic pour visual regression.

---

## 9. CI gates

### 9.1 GitHub Actions workflow

```yaml
# .github/workflows/checkout-funnel-ci.yml
name: Checkout Funnel CI

on:
  pull_request:
    paths:
      - 'apps/web/src/**'
      - 'apps/web/e2e/**'
      - 'docs/checkout-funnel/**'

jobs:
  unit-and-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test --coverage
      - name: Check coverage thresholds
        run: |
          bun run test:coverage:check  # fails if < 80% on wizard files

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: femiglow_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - run: bun install
      - run: bun run db:migrate
      - run: bun run playwright install --with-deps chromium
      - run: bun run build
      - run: bun run playwright test

  a11y:
    runs-on: ubuntu-latest
    needs: e2e
    steps:
      - run: bun run playwright test --grep @a11y

  lighthouse:
    runs-on: ubuntu-latest
    needs: e2e
    steps:
      - run: bun run lighthouse-ci
```

### 9.2 Coverage thresholds

```jsonc
// apps/web/vitest.config.ts
{
  coverage: {
    thresholds: {
      'src/components/commerce/wizard/**': { lines: 85, functions: 85, branches: 80 },
      'src/lib/checkout/**': { lines: 90, functions: 90, branches: 85 },
      'src/lib/tracking/gtm/**': { lines: 95, functions: 95, branches: 90 },
    }
  }
}
```

### 9.3 Pre-commit hooks

```bash
# .husky/pre-commit
bun run lint:staged
bun run test:related --coverage=false
```

---

## 10. Factories & utilities

### 10.1 Test utils

```tsx
// apps/web/src/test/utils.tsx (à étendre)

import { render as rtlRender } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import frMessages from '@/messages/fr/checkout.json';

export function render(ui: React.ReactElement, options?: { locale?: 'fr' | 'ar' }) {
  return rtlRender(
    <NextIntlClientProvider locale={options?.locale ?? 'fr'} messages={{ checkout: frMessages }}>
      {ui}
    </NextIntlClientProvider>
  );
}

export { userEvent } from '@testing-library/user-event';
export * from '@testing-library/react';
```

### 10.2 WizardProvider mock

```tsx
// apps/web/src/test/wizard-provider.tsx

export function WizardProvider({ initialState, children }) {
  useEffect(() => {
    useWizardStore.setState(initialState);
    return () => useWizardStore.getState().reset();
  }, []);
  return <>{children}</>;
}
```

### 10.3 Liste des fichiers tests à créer (récap)

**Unit (Vitest)** — ~12 fichiers, ~120 cas
```
src/lib/checkout/schemas/__tests__/lead.spec.ts
src/lib/checkout/form-config/__tests__/schema.spec.ts
src/lib/checkout/form-config/__tests__/variant-assignment.spec.ts
src/lib/checkout/form-config/__tests__/apply-overrides.spec.ts
src/lib/geo/__tests__/city-search.spec.ts
src/lib/tracking/gtm/__tests__/builders.spec.ts
src/components/commerce/wizard/utils/__tests__/normalizePhoneInput.spec.ts
src/components/commerce/wizard/state/__tests__/wizard-store.spec.ts
src/components/commerce/wizard/state/__tests__/wizard-machine.spec.ts
src/lib/checkout/repos/__tests__/lead.spec.ts
src/lib/checkout/repos/__tests__/form-config.spec.ts
src/lib/checkout/repos/__tests__/idempotency.spec.ts
```

**Integration (RTL + MSW)** — ~15 fichiers, ~60 cas
```
src/components/commerce/wizard/steps/__tests__/Step1Lead.spec.tsx
src/components/commerce/wizard/steps/__tests__/Step2Address.spec.tsx
src/components/commerce/wizard/steps/__tests__/Step3Payment.spec.tsx
src/components/commerce/wizard/__tests__/Wizard.spec.tsx
src/components/commerce/wizard/__tests__/WizardProgress.spec.tsx
src/components/commerce/wizard/__tests__/ThankYou.spec.tsx
src/components/commerce/wizard/fields/__tests__/PhoneInput.spec.tsx
src/components/commerce/wizard/fields/__tests__/WizardCombobox.spec.tsx
src/components/commerce/wizard/fields/__tests__/WizardField.spec.tsx
src/components/commerce/kit/__tests__/EmbedWizard.spec.tsx
src/components/admin/forms/__tests__/FormConfigList.spec.tsx
src/components/admin/forms/__tests__/FormConfigEditor.spec.tsx
src/components/admin/forms/__tests__/SortableFieldList.spec.tsx
src/components/admin/forms/__tests__/DiffViewer.spec.tsx
src/components/commerce/__tests__/CheckoutFlow.spec.tsx
```

**API routes** — ~7 fichiers, ~30 cas
```
src/app/api/checkout/lead/__tests__/route.spec.ts
src/app/api/checkout/lead/[leadId]/__tests__/route.spec.ts
src/app/api/checkout/lead/[leadId]/finalize/__tests__/route.spec.ts
src/app/api/checkout/form-config/active/__tests__/route.spec.ts
src/app/api/admin/form-config/__tests__/route.spec.ts
src/app/api/admin/form-config/[id]/__tests__/route.spec.ts
src/app/api/admin/form-config/[id]/publish/__tests__/route.spec.ts
```

**E2E (Playwright)** — ~10 fichiers, ~25 cas
```
apps/web/e2e/wizard-happy-path-fr.spec.ts
apps/web/e2e/wizard-happy-path-ar.spec.ts
apps/web/e2e/wizard-validation-errors.spec.ts
apps/web/e2e/wizard-resume-abandoned.spec.ts
apps/web/e2e/wizard-network-errors.spec.ts
apps/web/e2e/kit-embed-mobile.spec.ts
apps/web/e2e/kit-embed-desktop.spec.ts
apps/web/e2e/admin/form-config-crud.spec.ts
apps/web/e2e/admin/form-config-rollback.spec.ts
apps/web/e2e/tracking/datalayer-sequence.spec.ts
```

**a11y** — ~3 fichiers, ~10 cas
```
apps/web/e2e/a11y/wizard-a11y.spec.ts
apps/web/e2e/a11y/admin-a11y.spec.ts
apps/web/e2e/a11y/focus-management.spec.ts
```

**Visuels** — ~2 fichiers, ~12 snapshots
```
apps/web/e2e/visual/wizard-snapshots.spec.ts
apps/web/e2e/visual/admin-snapshots.spec.ts
```

**Total estimé** : ~250 scénarios de test à écrire.
