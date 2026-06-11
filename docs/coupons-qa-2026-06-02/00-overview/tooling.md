# Outillage de test — conventions & socle technique

## 1. Stack confirmée dans le repo

- **Runner unitaire/intégration** : Vitest (`apps/web/vitest.config.ts`, include `src/**/*.test.{ts,tsx}`).
- **DOM** : `@testing-library/react` + `@testing-library/user-event` (rendu composants en JSDOM).
- **Mock réseau** : **MSW** (`msw` + `setupServer`).
- **E2E** : Playwright (`apps/web/playwright.config.ts`).
- **Accessibilité** : `@axe-core/playwright`.
- **DB de test** : dual-driver — `memoryStore()` par défaut (sans Postgres), ou `__setTestDb()` avec PGlite/Postgres in-process pour exercer le vrai SQL (cf. `apps/web/src/lib/db/client.ts:209`).

## 2. Arborescence de test cible (à créer pendant l'implémentation)

```
apps/web/src/
├── lib/coupons/
│   ├── engine.ts            engine.test.ts            (U)
│   ├── context.ts           context.test.ts           (U)
│   ├── eligibility.ts       eligibility.test.ts       (U)
│   └── bucketing.ts         bucketing.test.ts         (U)
├── lib/db/queries/
│   ├── coupon-repo.ts       coupon-repo.test.ts       (U/intégration memoryStore + PGlite)
│   └── coupon-event-repo.ts coupon-event-repo.test.ts
├── app/api/admin/coupons/   *.route.test.ts           (C)
├── components/sections/     CouponWelcomeNote.test.tsx (I, MSW)
└── test/
    ├── msw/
    │   ├── server.ts                 setupServer partagé
    │   ├── coupons-handlers.ts       handlers /api/admin/coupons/**
    │   └── checkout-handlers.ts      handlers /api/checkout/**
    ├── factories/
    │   └── coupons.ts                makeCoupon(), makeContext(), makeCouponEvent()
    └── e2e/
        ├── visitor-coupon.spec.ts    parcours visiteur /kit → order
        └── admin-coupon.spec.ts      parcours opérateur /admin/coupons
```

## 3. Patron MSW (handler composable)

```ts
// test/msw/coupons-handlers.ts
import { http, HttpResponse } from 'msw';

export const couponsHandlers = [
  http.get('/api/admin/coupons', () => HttpResponse.json({ items: [], total: 0 })),
  http.post('/api/admin/coupons', async ({ request }) => {
    const body = await request.json();
    // validation minimale côté mock — ne JAMAIS dupliquer la logique métier
    if (!body?.label) return HttpResponse.json({ error: { code: 'invalid_input' } }, { status: 422 });
    return HttpResponse.json({ id: 'cpn_test', ...body }, { status: 201 });
  }),
];
```

Composition par cas : `server.use(http.post('/api/admin/coupons', () => HttpResponse.json(..., { status: 409 })))` pour simuler un conflit de version, etc.

## 4. Patron Vitest unitaire déterministe

```ts
import { beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';

beforeEach(() => resetMemoryStore());

// Temps injecté — jamais Date.now() réel
const NOW = new Date('2026-06-02T10:00:00Z');
```

## 5. Patron Playwright (parcours opérateur)

- Auth admin via storageState pré-seedé (réutiliser le helper d'auth admin existant).
- Réseau réel contre l'app montée ; pour isoler la donnée, seeder via API/seed avant le test.
- Assertions par **rôle ARIA + texte exact** (`getByRole('button', { name: 'Activer' })`).
- Anti-flake : auto-waiting Playwright, jamais de `waitForTimeout` arbitraire.

## 6. Commandes (détaillées dans 99-runbook)

```bash
pnpm test                      # vitest (unit + intégration MSW)
pnpm test --coverage           # avec couverture (gates)
pnpm exec playwright test      # E2E
pnpm exec playwright test --project=chromium e2e/admin-coupon.spec.ts
pnpm lint && pnpm typecheck    # qualité statique
```

## 7. Données sensibles & PII

`coupon_events.visitorKey` est un **hash anonyme** — aucun test ne doit y écrire d'email/téléphone en clair. Les fixtures utilisent des clés du type `vk_<hash8>`.
