# Test strategy — Pyramide, coverage, chaos

> Notre philosophie : **on teste ce qui casse**. La pyramide guide la quantité, pas la qualité. Un test fragile est pire que pas de test : il bouffe du temps en CI pour rien.

## La pyramide en pratique

```
ULTIMATE
  └─ 1 mégasuite nightly, valide TOUTE la pipeline (30 min)

E2E Playwright (~20 scénarios)
  └─ Parcours utilisateur clés. Frontend + backend + DB réels.
  └─ MSW pour providers LLM (jamais d'appel internet réel).

Integration (~50 tests)
  └─ API + DB + services chaînés. Postgres test container.
  └─ Tests qui valident le contrat HTTP.

Unit (~500 tests)
  └─ Logique pure. Pas de DB, pas de réseau. Très rapide.
  └─ Vitest + jsdom pour React components.

MSW Handlers (~30 mocks)
  └─ Mocks OpenAI/Anthropic/Mistral/Gemini avec scénarios :
      success, slow, error 5xx, rate limit, partial stream, malformed.
```

## Règles d'attribution test ↔ niveau

| Type de logique | Niveau | Justification |
|---|---|---|
| Logique pure (regex match, math, parsing) | Unit | Rapide, isolé, sans IO |
| Composant React isolé | Unit (jsdom) | Snapshot + interactions |
| Service avec DB | Integration | Besoin DB réelle (test container) |
| API endpoint | Integration | Valide contrat HTTP + DB |
| Hook React + Zustand | Unit | jsdom suffit |
| Pipeline complet (regex → embedding → LLM → DB) | E2E | Bout en bout |
| Parcours utilisateur (clic launcher → reçu réponse) | E2E | UX validation |

## Coverage targets détaillés

### Bloquants CI (must pass)

```
lib/chat/services/intent/*           ≥ 90%
lib/chat/services/retrieval/*        ≥ 85%
lib/chat/services/tools/*            ≥ 95%
lib/chat/services/canned/*           ≥ 90%
lib/chat/services/orchestrator/*     ≥ 80%
lib/chat/store/*                     ≥ 85%
lib/chat/errors/*                    ≥ 95%
app/api/chat/*                       ≥ 80% (via integration)
```

### Warn-only (informational)

```
lib/chat/providers/*                 ≥ 75%
components/chat/*                    ≥ 70%
hooks/*                              ≥ 80%
app/admin/*                          ≥ 60%
```

### Exclus du coverage (intentionnel)

- `*.stories.tsx` (Storybook)
- `*.config.ts`
- `lib/chat/types/*` (pure types)
- `scripts/*` (one-shot scripts)
- Migration files

## Chaos engineering

### Principe

On simule des pannes pour vérifier que le système **dégrade gracieusement** au lieu de **planter**.

### Scénario Chaos-1 : Provider OpenAI down 50% (nightly)

```typescript
// tests/chaos/provider-50.spec.ts
test('provider chaos — openai 50% down, system degrades to anthropic', async ({ page }) => {
  // Setup MSW : 50% des calls openai retournent 503
  await mswServer.use(
    rest.post('https://api.openai.com/*', (req, res, ctx) => {
      if (Math.random() < 0.5) {
        return res(ctx.status(503), ctx.json({ error: 'Service unavailable' }));
      }
      return res(ctx.status(200), ctx.json(mockOpenAIResponse));
    })
  );

  // Lancer 20 messages
  for (let i = 0; i < 20; i++) {
    await page.fill('[data-test=composer]', `Message ${i}`);
    await page.click('[data-test=send]');
    await page.waitForSelector('[data-test=message-assistant]', { timeout: 10000 });
  }

  // Assert : aucune erreur user-facing
  await expect(page.locator('[data-test=error-state]')).toHaveCount(0);

  // Assert : breaker s'est ouvert sur openai à un moment
  const breakerLogs = await fetch('/api/_test/breaker-history').then(r => r.json());
  expect(breakerLogs.some(l => l.provider === 'openai' && l.status === 'open')).toBe(true);
});
```

### Scénario Chaos-2 : Network latency 2s (nightly)

```typescript
test('network chaos — 2s added latency, UX still responsive', async ({ page }) => {
  await page.route('**/*', async (route) => {
    await new Promise(r => setTimeout(r, 2000));
    await route.continue();
  });

  // Vérifier : skeleton apparaît < 100ms, message < 5s
  await page.goto('/');
  await page.click('[data-test=launcher]');
  await expect(page.locator('[data-test=panel-skeleton]')).toBeVisible({ timeout: 200 });
  await expect(page.locator('[data-test=greeting-message]')).toBeVisible({ timeout: 5000 });
});
```

### Scénario Chaos-3 : DB connections closed (nightly, staging only)

```typescript
test('db chaos — connection pool exhausted, recovery automatic', async () => {
  // Staging only — on consomme volontairement le pool
  await Promise.all(Array.from({ length: 100 }, () => 
    fetch('https://staging.femiglow.com/api/chat/session', { method: 'POST' })
  ));

  // 30s plus tard, pool doit être OK
  await new Promise(r => setTimeout(r, 30000));
  const response = await fetch('https://staging.femiglow.com/api/chat/health');
  expect(response.status).toBe(200);
  expect((await response.json()).serviceLevel).toBe(1);
});
```

### Scénario Chaos-4 : Provider rate limit hit (nightly)

```typescript
test('rate limit chaos — provider 429, breaker triggers, fallback works', async () => {
  await mswServer.use(
    rest.post('https://api.openai.com/*', (req, res, ctx) => {
      return res(ctx.status(429), ctx.json({ error: 'Rate limit exceeded' }));
    })
  );

  // 5 messages rapides
  for (let i = 0; i < 5; i++) {
    const res = await fetch('/api/chat/message', { /* ... */ });
    expect(res.ok).toBe(true);
  }

  // Breaker openai doit être ouvert
  const health = await fetch('/api/chat/health').then(r => r.json());
  expect(health.providers.openai.breakerStatus).toBe('open');
});
```

### Scénario Chaos-5 : Partial SSE stream (nightly)

```typescript
test('partial stream — provider coupe mid-response, error gracieuse', async () => {
  await mswServer.use(
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
      // Stream partiel : 3 chunks puis coupe
      return res(
        ctx.set('Content-Type', 'text/event-stream'),
        ctx.body('data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n'),
        ctx.body('data: {"choices":[{"delta":{"content":"jour"}}]}\n\n'),
        // STOP — pas de [DONE]
      );
    })
  );

  // Le client doit détecter la coupure et afficher état error gracieux
  const sse = await openSSEConnection('/api/chat/message', { text: 'salut' });
  // ... vérifier que le frontend gère l'aborted
});
```

## Tests Performance (Lighthouse CI)

### Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'https://staging.femiglow.com/',
        'https://staging.femiglow.com/admin/conversations',
        'https://staging.femiglow.com/about'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'mobile',
        throttling: { cpuSlowdownMultiplier: 4 }
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }]
      }
    }
  }
};
```

### Budget bundle

```javascript
// next.config.js + webpack-bundle-analyzer en CI
{
  entryBudget: { closed: 8_000, open: 60_000 }  // bytes gzipped
}
```

CI échoue si bundle augmente de plus de 2 kB.

## Tests A11y (axe-core)

```typescript
// tests/a11y/chat.a11y.spec.ts
import AxeBuilder from '@axe-core/playwright';

test.describe('Chat a11y', () => {
  test('chat launcher closed — no violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('chat panel open with messages — no violations', async ({ page }) => { /* ... */ });

  test('lead form visible — no violations', async ({ page }) => { /* ... */ });

  test('admin conversations page — no violations', async ({ page }) => { /* ... */ });

  test('RTL ar mode — no violations', async ({ page }) => { /* ... */ });
});
```

Bloquant CI : 0 violation "serious" ou "critical".

## Tests Load (k6)

```javascript
// tests/load/100-concurrent-sse.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    sse_stream: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 }
      ]
    }
  }
};

export default function() {
  const session = http.post('https://staging.femiglow.com/api/chat/session',
    JSON.stringify({ audience: 'b2c', language: 'fr' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(session, { 'session created': r => r.status === 200 });

  const sessionId = session.json('sessionId');
  const stream = http.post('https://staging.femiglow.com/api/chat/message',
    JSON.stringify({ sessionId, text: 'Bonjour, quels sont vos produits ?' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(stream, {
    'stream 200': r => r.status === 200,
    'response < 5s': r => r.timings.duration < 5000
  });
}
```

Cible : 100 VUs concurrents, p95 < 5s, error rate < 1%.

## Tests RGPD

```typescript
test('rgpd export — all user data exported', async () => {
  // Setup : créer session avec messages, lead, events
  const phone = '+212600000000';
  // ... setup data ...

  const exportRes = await fetch(`/api/admin/rgpd/export?phone=${phone}`);
  const data = await exportRes.json();

  expect(data).toMatchObject({
    sessions: expect.any(Array),
    messages: expect.any(Array),
    leads: expect.any(Array),
    events: expect.any(Array)
  });
  expect(data.leads).toHaveLength(1);
});

test('rgpd forget — all user data anonymized', async () => {
  const phone = '+212600000000';
  // ... setup data ...

  await fetch(`/api/admin/rgpd/forget`, {
    method: 'POST',
    body: JSON.stringify({ phone })
  });

  // Vérifier anonymisation
  const messages = await db.query.chatMessages.findMany({
    where: { /* session lié au phone */ }
  });
  expect(messages.every(m => m.text === '<REDACTED_GDPR_REQUEST>')).toBe(true);
});
```

## Tests sécurité

```typescript
test('tool whitelist — sensitive fields never returned', async () => {
  const tool = await getProduct({ productId: 'kit-femiglow' });
  expect(tool.cost).toBeUndefined();
  expect(tool.margin).toBeUndefined();
  expect(tool.supplier).toBeUndefined();
  expect(tool.price_mad).toBeDefined();
  expect(tool.name).toBeDefined();
});

test('rate limit lead — 4th attempt blocked', async () => {
  const phone = '+212600000000';
  for (let i = 0; i < 3; i++) {
    const res = await fetch('/api/chat/lead', {
      method: 'POST',
      body: JSON.stringify({ phone, sessionId: 'test' })
    });
    expect(res.ok).toBe(true);
  }
  const res4 = await fetch('/api/chat/lead', {
    method: 'POST',
    body: JSON.stringify({ phone, sessionId: 'test' })
  });
  expect(res4.status).toBe(429);
});

test('admin auth — unauthorized access blocked', async () => {
  const res = await fetch('/api/admin/intents');
  expect(res.status).toBe(401);
});
```

## Convention de mocks (MSW)

Détails dans `msw-handlers.md`.

Principe : tous les providers LLM sont **toujours** mockés en test, jamais d'appel réel sauf en staging dédié.

## CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg15
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run db:migrate:up
      - run: npm run db:seed:test
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres: { ... }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e

  a11y:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:a11y

  perf:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:perf
      - run: lhci upload

  bundle:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: npm run analyze-bundle
      - run: node scripts/check-bundle-size.js  # blocking si > +2kB

  # ULTIMATE nightly (cron)
  ultimate:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - run: npm run test:ultimate
```

## Anti-patterns stratégie

- ❌ Couverture 100% obsessionnelle (on ignore les tests qui n'apportent rien).
- ❌ Pas de tests intégration : on prie pour que ça marche en prod.
- ❌ Tests E2E qui dépendent d'internet réel : flake garanti.
- ❌ Chaos uniquement en prod : on découvre les bugs sous stress utilisateur.
- ❌ Skip tests "temporaires" qui durent 6 mois.
- ❌ Tests qui ne sont jamais exécutés (CI silencieuse).
