# 70.2 — Jest / Vitest suite design

## Stratégie

Le projet utilise **Vitest** (compatible avec l'API Jest). Tous les tests
unitaires partagent ces conventions.

### Conventions

- `.test.ts` à côté du fichier sous test
- `.integration.test.ts` pour les tests qui touchent plusieurs fichiers
- Mocking via `vi.mock()`
- Async via async/await

### Hierarchy de tests

```
src/
├── lib/tracking/
│   ├── providers/
│   │   ├── google-ads.ts
│   │   ├── google-ads.test.ts ✨ NEW (refonte)
│   │   ├── google.ts
│   │   ├── meta.ts
│   │   └── event-mapping.test.ts
│   ├── server/
│   │   ├── dispatcher.ts
│   │   └── dispatcher.test.ts ✨ MODIFY (event_id, categorization)
│   ├── gtm/
│   │   ├── config-store.ts
│   │   └── config-store.test.ts ✨ MODIFY (clone method)
│   ├── categorization.ts ✨ NEW
│   ├── categorization.test.ts ✨ NEW
│   └── hooks/
│       ├── useTrackingClient.test.ts
│       └── useFormStartTracking.test.ts ✨ NEW
└── components/admin/tracking/
    ├── gtm/
    │   └── GtmConfigForm.test.tsx ✨ MODIFY (mode=edit, sync indicators)
    ├── categorization/
    │   └── EventCategorizationTable.test.tsx ✨ NEW
    └── analytics/
        └── ProvidersAnalyticsTable.test.tsx ✨ NEW
```

## Modèle de test type : adapter Google Ads

```typescript
// lib/tracking/providers/google-ads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleAdsAdapter } from './google-ads';

const mockProvider: TrackingProvider = {
  id: 'tp_gads_001',
  kind: 'google_ads',
  status: 'enabled',
  pixelId: 'AW-18136327114',
  config: {
    googleAdsCustomerId: '7082602195',
    googleAdsConversionActions: {
      purchase: {
        actionLabel: 'AbCdEf123Abc',
        category: 'purchase',
        defaultValue: 19900,
        defaultCurrency: 'MAD',
      },
    },
    googleAdsOAuth: {
      refreshToken: 'enc-token',
      iv: '...',
      tag: '...',
    },
  },
  // ... autres champs
} as TrackingProvider;

const mockContext = {
  eventName: 'purchase',
  eventId: 'evt-uuid-1',
  params: {
    orderId: 'o_abc',
    value: 199,
    currency: 'MAD',
    email: 'user@example.com',
    phone: '+212600000000',
  },
  gclid: 'Cj0KCQjw...',
  receivedAt: new Date('2026-05-13T12:00:00Z'),
  consent: { ad_storage: 'granted', /* ... */ },
};

describe('googleAdsAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('supports()', () => {
    it('returns true for purchase', () => {
      expect(googleAdsAdapter.supports('purchase')).toBe(true);
    });
    it('returns false for page_view', () => {
      expect(googleAdsAdapter.supports('page_view')).toBe(false);
    });
  });

  describe('dispatch()', () => {
    it('skips when status disabled', async () => {
      const result = await googleAdsAdapter.dispatch(
        { ...mockProvider, status: 'disabled' },
        mockContext,
      );
      expect(result.status).toBe('skipped');
      expect(result.error).toBe('provider_disabled');
    });

    it('skips when no customer_id', async () => {
      const provider = { ...mockProvider };
      delete (provider.config as any).googleAdsCustomerId;
      const result = await googleAdsAdapter.dispatch(provider, mockContext);
      expect(result.status).toBe('skipped');
    });

    it('skips when no conversion_action for event', async () => {
      const provider = { ...mockProvider };
      (provider.config as any).googleAdsConversionActions = {};
      const result = await googleAdsAdapter.dispatch(provider, mockContext);
      expect(result.status).toBe('skipped');
    });

    it('posts correct body to API', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );
      vi.mocked(global.fetch).mockResolvedValueOnce(  // oauth refresh
        new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 }),
      );

      await googleAdsAdapter.dispatch(mockProvider, mockContext);

      const calls = vi.mocked(global.fetch).mock.calls;
      const adsCall = calls.find(([url]) => String(url).includes('uploadClickConversions'));
      expect(adsCall).toBeDefined();
      const body = JSON.parse(adsCall![1]!.body as string);
      expect(body.conversions[0]).toMatchObject({
        gclid: 'Cj0KCQjw...',
        conversionAction: 'customers/7082602195/conversionActions/AbCdEf123Abc',
        conversionValue: 199,
        currencyCode: 'MAD',
        orderId: 'o_abc',
      });
      expect(body.conversions[0].userIdentifiers).toHaveLength(2); // email + phone
    });

    it('hashes email and phone correctly (SHA-256)', async () => {
      // ...
    });

    it('retries 3x on 429 with backoff', async () => {
      // Mock 3 × 429, then 200
      // verify attempts === 4 (1 initial + 3 retries)
    });

    it('handles 401 by refreshing token and retrying', async () => {
      // First call 401, oauth refresh, second call 200
      // verify token cache invalidated
    });
  });
});
```

## Modèle de test : dispatcher

```typescript
// lib/tracking/server/dispatcher.test.ts
describe('dispatcher', () => {
  it('propagates event_id to all providers', async () => {
    const adapter = mockAdapter();
    const ctx = makeContext({ eventId: 'evt-uuid-1' });
    await dispatchToProviders(ctx, [adapter]);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'evt-uuid-1' }),
    );
  });

  it('respects consent permissions per provider', async () => {
    const ctx = makeContext({
      consent: { ad_storage: 'denied', analytics_storage: 'granted' },
    });
    const adsAdapter = mockAdapter({ kind: 'google_ads' });
    const ga4Adapter = mockAdapter({ kind: 'google_ga4' });
    await dispatchToProviders(ctx, [adsAdapter, ga4Adapter]);
    expect(adsAdapter.dispatch).not.toHaveBeenCalled(); // ad_storage denied
    expect(ga4Adapter.dispatch).toHaveBeenCalled();
  });

  it('continues on individual provider failure', async () => {
    const failing = mockAdapter({ throws: new Error('boom') });
    const succeeding = mockAdapter();
    const results = await dispatchToProviders(ctx, [failing, succeeding]);
    expect(results.providersDispatched).toHaveLength(2);
    expect(results.providersResults.failing.status).toBe('failed');
    expect(results.providersResults.succeeding.status).toBe('success');
  });
});
```

## Modèle test composant UI

```typescript
// components/admin/tracking/categorization/EventCategorizationTable.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventCategorizationTable } from './EventCategorizationTable';
import { SWRConfig } from 'swr';

const mockFetcher = vi.fn();

describe('EventCategorizationTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetcher.mockResolvedValue([
      {
        name: 'purchase',
        isConversion: true,
        googleAdsCategoryDefault: 'purchase',
        googleAdsCategoryOverride: null,
      },
      {
        name: 'stock_notify_subscribe',
        isConversion: false,
        googleAdsCategoryDefault: null,
        googleAdsCategoryOverride: 'lead',
        overrideUpdatedBy: 'u_sara',
      },
    ]);
  });

  function renderWithSWR() {
    return render(
      <SWRConfig value={{ provider: () => new Map(), fetcher: mockFetcher }}>
        <EventCategorizationTable />
      </SWRConfig>,
    );
  }

  it('renders all events', async () => {
    renderWithSWR();
    expect(await screen.findByText('purchase')).toBeInTheDocument();
    expect(screen.getByText('stock_notify_subscribe')).toBeInTheDocument();
  });

  it('shows override badge for events with override', async () => {
    renderWithSWR();
    await screen.findByText('stock_notify_subscribe');
    expect(screen.getByText(/override/i)).toBeInTheDocument();
  });

  it('optimistically updates on category change', async () => {
    const updateSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = updateSpy;

    renderWithSWR();
    await screen.findByText('purchase');

    const dropdown = screen.getByLabelText('Catégorie de purchase');
    fireEvent.change(dropdown, { target: { value: 'lead' } });

    // Optimistic update visible
    await waitFor(() => {
      expect(screen.getByDisplayValue('lead')).toBeInTheDocument();
    });

    // Server sync called
    expect(updateSpy).toHaveBeenCalledWith(
      '/api/admin/tracking/events/categorization',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('purchase'),
      }),
    );
  });
});
```

## Coverage targets

| Module | Cible |
|---|---|
| `lib/tracking/providers/google-ads.ts` | ≥ 90% |
| `lib/tracking/server/dispatcher.ts` | ≥ 85% |
| `lib/tracking/gtm/config-store.ts` | 100% |
| `lib/tracking/categorization.ts` | 100% |
| `app/api/track/route.ts` | ≥ 80% |
| `app/api/admin/tracking/*/route.ts` | ≥ 75% |
| `components/admin/tracking/**/*.tsx` | ≥ 70% |

Mesurer avec :
```bash
pnpm exec vitest run --coverage
```

## CI

Tests Jest dans le pipeline CI :
```yaml
- run: pnpm exec vitest run --coverage
- run: pnpm exec vitest run --coverage --reporter=junit > test-results.xml
```
