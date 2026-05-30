# 04 — Stratégie de tests

## Pyramide

```
┌──────────────────────────┐
│  E2E Playwright (A7)     │   5 scénarios canal + 3 dégradation
├──────────────────────────┤
│  Integration vitest      │   /api/track + DB persistence
├──────────────────────────┤
│  Unit vitest             │   taxonomy + enrichEvent + middleware helpers
└──────────────────────────┘
```

## Couverture cible

| Module | Tests vitest | Coverage min |
|---|---|---|
| `taxonomy.ts` | 30+ | 100% |
| `enrich-event.ts` | 20+ | 95% |
| `request-signals.ts` | 10+ | 95% |
| `events-log.ts` (étendu) | 15+ | 90% (existant + attribution) |
| `middleware.ts` (étendu) | 8+ | nouvelles routes seulement |

## Tests E2E `@attribution-flow`

Fichier : `apps/web/e2e/attribution-end-to-end.spec.ts`

```ts
test.describe('@attribution-flow', () => {

  test('Meta paid : utm_source=meta + fbclid → paid_social', async ({ page, request }) => {
    await page.goto('/kit?utm_source=meta&utm_medium=cpc&fbclid=ABC123');
    await page.waitForResponse(r => r.url().includes('/api/track'));

    const events = await request.get('/api/admin/debug/last-events?limit=1').then(r => r.json());
    expect(events[0].trafficSource).toBe('paid_social');
    expect(events[0].utm.source).toBe('meta');
    expect(events[0].fbc).toMatch(/^fb\.1\.\d+\.ABC123$/);
  });

  test('Google paid : gclid → paid_search', ...);
  test('TikTok organic : referrer tiktok.com → organic_social', ...);
  test('Email : utm_source=newsletter → email', ...);
  test('Direct : no signals → direct', ...);
});

test.describe('@attribution-degradation', () => {
  test('consent denied : events fire mais attribution NULL', ...);
  test('cookies blocked : fallback request signals', ...);
  test('first visit : no DB row → request signals only', ...);
});
```

## Endpoint debug

`apps/web/src/app/api/admin/debug/last-events/route.ts` (admin-only)

Retourne les N derniers events avec tous les champs attribution exposés.

## Fixtures vitest

⚠️ **Anti-pattern à éviter** : les fixtures `overview.test.ts` actuelles injectent `trafficSource` à la main, masquant le bug. À refactorer pour utiliser le pipeline réel (enrichEvent → logEvent → SELECT).

## CI gates

```yaml
- pnpm --filter @femiglow/web test taxonomy enrich-event events-log
- pnpm --filter @femiglow/web e2e --grep "@attribution-flow|@attribution-degradation"
```

Tous doivent passer avant merge sur master.
