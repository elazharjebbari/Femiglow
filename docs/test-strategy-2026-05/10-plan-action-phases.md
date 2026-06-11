# 10 — Plan d'action par phase

## Vue d'ensemble

8 phases sur 2 semaines (5-7 j-h dev + setup CI continu).

| Phase | Sujet | Effort | Sprint |
|---|---|---|---|
| **T0** | Préparation : audit Playwright config, scripts utilitaires | ½ j | 1 |
| **T1** | Factories + fixtures + helpers réutilisables | 1 j | 1 |
| **T2** | Backend tests gap-filling | 1 j | 1 |
| **T3** | Frontend UI tests + a11y axe | 1 j | 2 |
| **T4** | E2E Playwright — câblage + run + green | 1-2 j | 2 |
| **T5** | MSW handlers OpenAI/Anthropic/Meta/TikTok/Snap | ½ j | 2 |
| **T6** | Perf (Lighthouse + k6) + sécurité OWASP | 1 j | 3 |
| **T7** | CI workflows + monitoring + heartbeat | ½ j | 3 |

---

## PHASE T0 — Préparation (½ j)

### T0.1 — Audit Playwright config

**Objectif** : vérifier que `playwright.config.ts` est utilisable.

```bash
# Check existant
cat apps/web/playwright.config.ts

# Vérifier que les workers / retries / projects sont OK
pnpm --filter @femiglow/web exec playwright test --list
```

### T0.2 — Scripts package.json

Ajouter scripts manquants dans `apps/web/package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:integration": "vitest run --grep integration",
    "test:coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "e2e:critical": "playwright test --grep @critical",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "lighthouse": "lhci autorun",
    "k6:track": "k6 run scripts/loadtest-track.js",
    "smoke": "tsx scripts/smoke-live-systems.ts",
    "test:all": "pnpm test && pnpm e2e:critical && pnpm smoke"
  }
}
```

### T0.3 — Dépendances dev à installer

```bash
pnpm add -D -w \
  @lhci/cli \
  k6 \
  @axe-core/playwright \
  @testing-library/user-event
```

### T0.4 — Setup global vitest

`apps/web/src/test/setup.ts` (création / extension) :

```ts
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './msw/handlers';

export const FROZEN_NOW = new Date('2026-05-24T10:00:00.000Z');
export const mswServer = setupServer(...handlers);

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'warn' });
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
  // Reset Redis memory store
  if (typeof globalThis.redisMemoryReset === 'function') {
    globalThis.redisMemoryReset();
  }
});

afterEach(() => {
  vi.useRealTimers();
  mswServer.resetHandlers();
});
```

### Critères acceptation T0
- [ ] `pnpm exec playwright --version` retourne version récente
- [ ] `pnpm test` retourne au moins 4 000 tests verts (pas de régression)
- [ ] Scripts package.json fonctionnels
- [ ] MSW server activé globalement dans setup

---

## PHASE T1 — Factories + helpers (1 j)

### T1.1 — Base factory + 5 factories core

Créer dans l'ordre :
1. `src/test/factories/base.ts` — defineFactory helper
2. `src/test/factories/user.factory.ts`
3. `src/test/factories/order.factory.ts`
4. `src/test/factories/lead.factory.ts`
5. `src/test/factories/chat-session.factory.ts`
6. `src/test/factories/tracking-event.factory.ts`

Pour chaque : **+ tests** dans `*.test.ts` (vérifier Zod schema match).

### T1.2 — Helpers RTL + Playwright

```ts
// src/test/helpers/render-with-providers.tsx
import { render, type RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <SomeProvider>{children}</SomeProvider>
    ),
    ...options,
  });
}
```

### T1.3 — Helpers API client typé

```ts
// src/test/helpers/api-client.ts
export async function postTrack(events: Array<unknown>) { ... }
export async function postChatMessage(sessionId: string, text: string) { ... }
export async function getDebugEvents(sessionId: string) { ... }
```

### T1.4 — Scénarios prédéfinis

Cf. `03-data-strategy.md` § Data scenarios prédéfinis.

### Critères acceptation T1
- [ ] 12 factories créées + 12 fichiers test associés
- [ ] 5 helpers RTL + Playwright en place
- [ ] 5 scénarios métier prédéfinis (`scenarioMetaPaidConversion`, etc.)
- [ ] **+50 tests unitaires** sur les factories elles-mêmes

---

## PHASE T2 — Backend tests gap-filling (1 j)

### T2.1 — Routes API sans test

```bash
# Lister les routes sans test
find apps/web/src/app/api -name "route.ts" | while read r; do
  test="${r%.ts}.test.ts"
  [ ! -f "$test" ] && echo "MISSING: $r"
done
```

Pour chaque route critique manquante : créer test minimal happy + error path.

### T2.2 — Middleware Next.js

```ts
// apps/web/src/middleware.test.ts
describe('middleware — click ID capture', () => {
  it('?fbclid=ABC → cookie _fg_fbclid set', () => {...});
  it('?gclid=XYZ → cookie _fg_gclid set', () => {...});
  it('UTM params → _fg_landing_qs JSON cookie', () => {...});
  it('_fbc reconstruit depuis fbclid', () => {...});
});
```

### T2.3 — Crons handlers

```ts
// apps/web/src/app/api/cron/tracking/capi-flush/route.test.ts
describe('capi-flush cron', () => {
  it('GET avec x-vercel-cron header → 200', async () => {...});
  it('GET sans auth → 401', async () => {...});
  it('flush vide → stats avec count=0', async () => {...});
});
```

### T2.4 — Webhooks outbound

```ts
describe('webhook signature', () => {
  it('payload signé avec HMAC SHA256', () => {...});
  it('retry après 500 → 3 attempts max', () => {...});
});
```

### Critères acceptation T2
- [ ] +200 tests vitest sur routes API + middleware + crons
- [ ] Coverage routes critiques ≥ 80%
- [ ] 0 régression sur tests existants

---

## PHASE T3 — Frontend UI tests + a11y (1 j)

### T3.1 — Composants sans test (priorisés)

```bash
# Lister composants sans test
find apps/web/src/components -name "*.tsx" -not -name "*.test.*" | while read c; do
  test="${c%.tsx}.test.tsx"
  [ ! -f "$test" ] && echo "MISSING: $c"
done | head -20
```

Prioriser :
- `HeroProduit`, `WizardShell`, `KitCommanderSection` (composants user-facing)
- `OverviewTopSources`, `AdminShell` (composants admin)
- `ChatWidget` (interactions complexes)

### T3.2 — A11y axe coverage

```ts
// e2e/a11y-comprehensive.spec.ts
const pagesToCheck = [
  '/', '/kit', '/journal', '/maison', '/rituel',
  '/admin/analytics', '/admin/live-health',
];

for (const pageUrl of pagesToCheck) {
  test(`@axe ${pageUrl} — 0 violation serious/critical`, async ({ page }) => {
    await page.goto(pageUrl);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
}
```

### T3.3 — Visual regression baselines

Snapshots Playwright sur les pages critiques :
```ts
test('@visual /kit hero baseline', async ({ page }) => {
  await page.goto('/kit');
  await expect(page.locator('section[aria-labelledby="hero-kit-title"]'))
    .toHaveScreenshot('hero-kit.png', { maxDiffPixelRatio: 0.02 });
});
```

### Critères acceptation T3
- [ ] +300 tests composants React (Wizard, Hero, dashboards admin)
- [ ] 7 pages avec axe a11y green
- [ ] 5 snapshots visual regression baselines

---

## PHASE T4 — E2E Playwright opérationnels (1-2 j)

### T4.1 — Validation specs créés (Sprint 7)

Run en local sur build prod :
```bash
pnpm --filter @femiglow/web build
pnpm --filter @femiglow/web start &
pnpm --filter @femiglow/web exec wait-on http://localhost:3000
pnpm --filter @femiglow/web exec playwright test live-chat live-publishing live-tracking attribution kit-layout
```

### T4.2 — Fix specs qui ne passent pas

Pour chaque spec failed :
- Identifier cause (sélecteur DOM, timing, état DB)
- Ajuster ou skip avec raison documentée
- Tag `@critical` les flows business essentiels

### T4.3 — Workflow CI Playwright

`.github/workflows/e2e.yml` :
```yaml
name: E2E tests
on:
  pull_request:
    paths-ignore: ['docs/**', '*.md']

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: femiglow_test }
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @femiglow/web exec playwright install --with-deps chromium
      - run: pnpm --filter @femiglow/web build
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/femiglow_test
      - run: pnpm --filter @femiglow/web start &
        env: { ... }
      - run: pnpm exec wait-on http://localhost:3000 --timeout 60000
      - run: pnpm --filter @femiglow/web e2e:critical
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

### Critères acceptation T4
- [ ] **Tous les 41 specs Playwright run au moins une fois**, ≥ 90% pass
- [ ] CI Playwright actif sur les PR
- [ ] 15 specs taggés `@critical` (smoke E2E essential)
- [ ] Report HTML archivé en CI artifact

---

## PHASE T5 — MSW handlers complets (½ j)

### T5.1 — OpenAI streaming handlers

```ts
// src/test/msw/openai-handlers.ts
import { http, HttpResponse } from 'msw';

export const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = await request.json();
    if (body.stream) {
      // SSE simulation
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(/* chunks */);
          controller.close();
        },
      });
      return new HttpResponse(stream, {
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    return HttpResponse.json({ choices: [...] });
  }),
  http.post('https://api.openai.com/v1/moderations', () =>
    HttpResponse.json({ results: [{ flagged: false, categories: {}, category_scores: {} }] }),
  ),
];
```

### T5.2 — Anthropic, Meta, TikTok, Snap, Pinterest handlers

Pattern identique. Récupérer les exemples response depuis docs officielles.

### T5.3 — Aggregator handlers

```ts
// src/test/msw/handlers.ts
import { openaiHandlers } from './openai-handlers';
import { anthropicHandlers } from './anthropic-handlers';
import { metaCapiHandlers } from './meta-capi-handlers';
// ...

export const handlers = [
  ...openaiHandlers,
  ...anthropicHandlers,
  ...metaCapiHandlers,
  // ...existants
];
```

### Critères acceptation T5
- [ ] 6 nouveaux handlers (openai, anthropic, meta, tiktok, snap, pinterest)
- [ ] Aggregator central dans `handlers.ts`
- [ ] **+30 tests intégration** débloqués (fallback chat, batching CAPI)

---

## PHASE T6 — Perf + sécurité (1 j)

### T6.1 — Lighthouse CI

```bash
# Install
pnpm add -D -w @lhci/cli
```

`lighthouserc.json` :
```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/kit", "http://localhost:3000/kit?layout=v2"],
      "numberOfRuns": 3,
      "startServerCommand": "pnpm --filter @femiglow/web start"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

### T6.2 — k6 load tests

```js
// scripts/loadtest-track.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post(
    `${__ENV.BASE_URL}/api/track`,
    JSON.stringify({ events: [/* synth event */] }),
    { headers: { 'content-type': 'application/json' } },
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

### T6.3 — Tests sécurité OWASP

```ts
// e2e/security.spec.ts
test.describe('@security', () => {
  test('XSS dans chat input échappé', async ({ page }) => {
    await page.goto('/');
    await chatLauncher(page).click();
    let dialogTriggered = false;
    page.on('dialog', () => { dialogTriggered = true; });
    await chatInput(page).fill('<script>alert(1)</script>');
    await chatSend(page).click();
    await page.waitForTimeout(2000);
    expect(dialogTriggered).toBe(false);
  });

  test('SQL injection /api/track event_id', async ({ request }) => {
    const res = await request.post('/api/track', {
      data: { events: [{ event_id: "'; DROP TABLE x;--", event: 'x', /* etc */ }] },
    });
    expect([400, 422, 200]).toContain(res.status());
    // Verify table not dropped via subsequent query
  });

  test('CSRF protection on POST /api/checkout/order', async ({ request }) => {
    const res = await request.post('/api/checkout/order', {
      headers: { origin: 'https://malicious.com' },
      data: { ... },
    });
    expect([403, 401]).toContain(res.status());
  });
});
```

### T6.4 — Dependency audit en CI

```yaml
# .github/workflows/security.yml
- run: pnpm audit --production --audit-level=high
- run: |
    # Fail si nouvelles vulns vs main
    pnpm audit --json | jq '.advisories | length' > new.json
    git fetch origin main && git checkout origin/main
    pnpm audit --json | jq '.advisories | length' > main.json
    [ $(cat new.json) -le $(cat main.json) ]
```

### Critères acceptation T6
- [ ] Lighthouse CI configuré, budget LCP < 2.5s sur `/kit`
- [ ] k6 script run pendant CI nightly, P95 < 200ms `/api/track`
- [ ] 5 tests security OWASP basics (XSS, SQLi, CSRF, idempotency, rate limit)
- [ ] `pnpm audit` automatique en CI, gate sur critical

---

## PHASE T7 — CI workflows + monitoring (½ j)

### T7.1 — GitHub Actions workflows

Voir `12-ci-cd-workflows.md` pour templates complets :
- `test-unit.yml` — vitest sur chaque PR
- `test-integration.yml` — vitest + MSW
- `e2e.yml` — Playwright critical path
- `e2e-full.yml` — Playwright tous tests (nightly)
- `perf.yml` — Lighthouse CI sur preview deployments
- `security.yml` — pnpm audit + OWASP
- `smoke-post-deploy.yml` — smoke-live-systems après merge master

### T7.2 — Heartbeat post-deploy

Vercel cron horaire qui lance smoke + alerte Sentry si fail :

```ts
// app/api/cron/smoke-heartbeat/route.ts
export async function GET(request: Request) {
  authorizeCron(request);
  const result = await runSmokeChecks();
  if (result.failed > 0) {
    Sentry.captureMessage('smoke_heartbeat_failed', {
      level: 'error',
      tags: { failedChecks: result.failed },
    });
  }
  return NextResponse.json(result);
}
```

`vercel.json` :
```json
{ "path": "/api/cron/smoke-heartbeat", "schedule": "0 * * * *" }
```

### T7.3 — Slack alerts

Webhook configuré pour :
- ❌ Smoke fail post-deploy
- ❌ Lighthouse perf regression > 5 points
- ❌ Dependency audit critical
- ❌ Test coverage drop > 2%

### Critères acceptation T7
- [ ] 6 workflows GitHub Actions actifs
- [ ] Heartbeat cron horaire en prod
- [ ] Slack notifications sur 4 événements
- [ ] Runbook documenté pour interpretation alertes

---

## Synthèse Definition of Done global

À la fin des 8 phases :

- [ ] **~5 200 tests vitest verts** (4 678 + 522 nouveaux)
- [ ] **150 specs Playwright** dont 41 du Sprint live-systems + 41 attribution/landing
- [ ] **Coverage** : ≥ 85% `lib/`, ≥ 75% `app/`
- [ ] **Lighthouse perf** : `/kit` mobile ≥ 85
- [ ] **A11y** : 7 pages avec 0 violation serious/critical
- [ ] **Security** : 5 tests OWASP basics + CI audit
- [ ] **Smoke** : heartbeat horaire + post-deploy
- [ ] **CI** : 6 workflows actifs avec gates
- [ ] **Documentation** : 13 fichiers à jour + runbook validé
