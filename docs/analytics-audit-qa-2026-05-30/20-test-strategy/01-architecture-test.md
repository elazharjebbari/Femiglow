# 20.01 — Architecture de test (MSW + Vitest/RTL + Playwright)

Les **patterns de code canoniques** des 4 couches. Tout test du dossier s'y conforme. Cohérent avec
la stack du repo (`vitest.config.ts`, `src/test/setup/msw.setup.ts`, `playwright.config.ts`).

---

## 1. Arborescence des tests à produire

```
apps/web/
├── src/lib/analytics/
│   ├── queries/{funnel,cta,checkout}.spec.ts        # Vitest — justesse (compléter l'existant)
│   ├── filters.range-tz.spec.ts                     # Vitest — resolveRange + fuseau (AF-04)
│   └── format.currency.spec.ts                      # Vitest — devise MAD / unité (AF-02)
├── src/components/admin/analytics/
│   ├── funnel/FunnelDashboard.refetch.spec.tsx      # RTL+MSW — AF-01
│   ├── cta/CtaDashboard.refetch.spec.tsx            # RTL+MSW — AF-01 + revenu MAD
│   ├── checkout/CheckoutDashboard.refetch.spec.tsx  # RTL+MSW — AF-01
│   └── insights/InsightsView.refetch.spec.tsx       # RTL+MSW — vues + drawer
├── src/test/msw/analytics-handlers.ts               # MSW — handlers + scénarios paramétrables
├── src/test/fixtures/analytics/*.ts                 # fixtures déterministes (events, components)
└── e2e/analytics/
    ├── filters-reactivity.spec.ts                   # Playwright — AF-01 (cœur)
    ├── cta-revenue.spec.ts                          # Playwright — AF-02
    ├── funnel-operator.spec.ts
    ├── checkout-operator.spec.ts
    ├── insights-operator.spec.ts
    └── a11y.spec.ts                                 # axe sur les 4 onglets
```

---

## 2. Couche Vitest — justesse des chiffres

Tester les queries avec le **memoryStore** (pas de DB) et une **horloge figée**. Pattern :

```ts
// queries/cta.spec.ts
import { afterEach, describe, expect, it } from 'vitest';
import { getCtaData } from '@/lib/analytics/queries/cta';
import { resetMemoryStore, seedEvents, seedComponents } from '@/test/fixtures/analytics';

const NOW = new Date('2026-05-20T12:00:00.000Z');

afterEach(() => resetMemoryStore());

describe('FN-CTA-08 — attribution last-click + revenu (AF-02)', () => {
  it('crédite le dernier CTA avant l’achat et le revenu en MAD (199, pas 1,99)', async () => {
    seedComponents([{ id: 'cmp_buy', name: 'Acheter', category: 'cta_primary' }]);
    seedEvents([
      ev('cta_click', { sessionId: 's1', anonymousId: 'a1', componentId: 'cmp_buy',
                        pageRoute: '/kit', at: '2026-05-20T10:00:00Z',
                        payload: { cta_intent: 'purchase' } }),
      ev('purchase',  { sessionId: 's1', anonymousId: 'a1', at: '2026-05-20T10:05:00Z',
                        payload: { value: 199, currency: 'MAD' } }),
    ]);

    const data = await getCtaData(filters({ period: '7d' }), NOW);

    expect(data.rows[0]?.purchasesAttributed).toBe(1);
    // AF-02 : revenu attendu = 199 MAD. Échoue tant que value(MAD) est traité comme cents.
    expect(data.totals.revenueAttributedCents).toBe(19900); // 199,00 MAD en cents
  });
});
```

> Le test **encode la décision** : on attend que 199 MAD soit représenté en cents (`19900`) à la
> source, pour que `formatCurrency` affiche « 199 MAD ». Tant que le bug AF-02 est là, il échoue —
> c'est le but (test de non-régression).

---

## 3. Couche Composant + MSW — états & refetch (verrou AF-01)

On monte le Dashboard, on **branche MSW** pour renvoyer des jeux **différents par filtre**, puis on
simule le changement de filtre et on vérifie que l'affichage **change**.

```tsx
// cta/CtaDashboard.refetch.spec.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup/msw.setup';
import { CtaDashboard } from './CtaDashboard';
import { ctaData } from '@/test/fixtures/analytics';

it('FN-CTA-02/AF-01 — changer la période rafraîchit les KPI', async () => {
  server.use(
    http.get('/api/admin/analytics/cta', ({ request }) => {
      const period = new URL(request.url).searchParams.get('period');
      return HttpResponse.json(
        period === '30d' ? ctaData({ clicks: 999 }) : ctaData({ clicks: 10 }),
      );
    }),
  );

  // initialData = vue "7d" (10 clics)
  render(<CtaDashboard initialFilters={{ period: '7d', device: 'all', traffic: 'all' }}
                       initialData={ctaData({ clicks: 10 })} currency="MAD" />);
  expect(await screen.findByText('10')).toBeInTheDocument();

  // l'opérateur passe à 30 jours (via la FilterBar qui change l'URL)
  await act(() => setUrl('?period=30d'));            // util de test qui pousse l'URL
  await waitFor(() => expect(screen.getByText('999')).toBeInTheDocument()); // AF-01
});
```

> Ce test **échoue aujourd'hui** (le composant fige `useState(initialFilters)`), démontrant AF-01
> au niveau composant. Après correctif (lecture de l'URL + refetch), il passe.

Handler MSW réutilisable (paramétrable par scénario) :

```ts
// src/test/msw/analytics-handlers.ts
import { http, HttpResponse } from 'msw';

export function analyticsHandlers(scenario: AnalyticsScenario = 'nominal') {
  return [
    http.get('/api/admin/analytics/funnel', ({ request }) =>
      HttpResponse.json(funnelResponse(scenario, new URL(request.url).searchParams))),
    http.get('/api/admin/analytics/cta', ({ request }) =>
      HttpResponse.json(ctaResponse(scenario, new URL(request.url).searchParams))),
    http.get('/api/admin/analytics/checkout', ({ request }) =>
      HttpResponse.json(checkoutResponse(scenario, new URL(request.url).searchParams))),
    http.get('/api/admin/analytics/insights/*', ({ request }) =>
      HttpResponse.json(insightsResponse(request))),
  ];
}
// scénarios : 'nominal' | 'empty' | 'error500' | 'highVolume' | 'firstRun'
```

---

## 4. Couche Playwright — point de vue opérateur

On pilote l'app réelle ; le réseau peut être **interception Playwright** (équivalent MSW) pour des
chiffres déterministes, ou une **base seedée**. Cœur : prouver qu'AF-01 est corrigé.

```ts
// e2e/analytics/filters-reactivity.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AF-01 — réactivité des filtres (Funnel/CTA/Checkout)', () => {
  for (const tab of ['funnel', 'cta', 'checkout'] as const) {
    test(`${tab} — changer la période met à jour les chiffres`, async ({ page }) => {
      await routeAnalytics(page, { byPeriod: { '7d': SMALL, '30d': BIG } }); // intercept
      await loginAsAdmin(page);
      await page.goto(`/admin/analytics/${tab}?period=7d`);

      const before = await page.getByTestId(`${tab}-dashboard`).innerText();
      await page.getByTestId('filter-period').selectOption('30d');

      await expect(page.getByTestId('filter-bar')).toHaveAttribute('data-pending', 'true');
      await expect.poll(async () =>
        page.getByTestId(`${tab}-dashboard`).innerText()).not.toBe(before); // AF-01
      await expect(page).toHaveURL(/period=30d/);
    });
  }
});
```

Conventions Playwright : sélection par `data-testid` (déjà présents : `*-dashboard`, `*-skeleton`,
`filter-bar`, `filter-period/device/traffic`, `filter-reset`) et par **rôle ARIA** ; jamais par
classe CSS. Téléchargements via `page.waitForEvent('download')`. a11y via `@axe-core/playwright`.

---

## 5. Horloge, données, isolation

| Préoccupation | Règle |
|---|---|
| Temps | Toujours injecter `now` (`getXData(filters, NOW)`) ; en e2e, fixer l'horloge serveur ou utiliser des fixtures datées relativement à un ancrage. |
| Données | `faker` **seedé** (`faker.seed(42)`), helpers `ev()`, `seedEvents()`, `ctaData()` déterministes. |
| Réseau | MSW (unit/intégration) ou route interception (Playwright). **Jamais** de vrai appel externe. |
| Isolation | `resetMemoryStore()` + `server.resetHandlers()` en `afterEach`. Pas d'état partagé. |
| Fuseau | Tester explicitement UTC vs `Africa/Casablanca` pour AF-04 (`TZ=Africa/Casablanca` en CI). |
