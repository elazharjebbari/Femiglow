# 04 — Stratégie de tests

## Pyramide

```
┌────────────────────────────────────┐
│  Smoke (production-ready scripts)  │  3 scripts post-deploy
├────────────────────────────────────┤
│  E2E Playwright                    │  20+ specs par système
├────────────────────────────────────┤
│  Integration MSW                   │  30+ tests avec mocks
├────────────────────────────────────┤
│  Unit vitest                       │  150+ tests
└────────────────────────────────────┘
```

## Couverture cible par module

| Module | Tests vitest | Coverage min |
|---|---|---|
| `lib/feature-flags/live-systems.ts` | 8 | 100% |
| `lib/redis/client.ts` | 10 | 95% |
| `lib/redis/dedup.ts` | 12 | 95% |
| `lib/redis/circuit-breaker.ts` | 15 | 95% |
| `lib/redis/rate-limit.ts` | 10 | 95% |
| `lib/chat/moderation.ts` | 10 | 95% |
| `lib/chat/providers/anthropic.ts` | 12 | 95% |
| `lib/chat/orchestrator.ts` (refactor) | +8 | étendre couverture existante |
| `lib/social-publishing/retry-policy.ts` | 8 | 100% |
| `lib/social-publishing/content-builder.ts` (refactor) | +10 | étendre couverture |
| `lib/tracking/event-mapper.ts` | 15 | 100% |
| `lib/tracking/server/dispatcher-batch.ts` | 12 | 95% |
| `lib/tracking/server/server-fire.ts` (refactor) | +5 | étendre couverture |

**Total nouveaux tests vitest** : ~150 tests.

---

## Tests unit (vitest)

### Redis helpers

```ts
// lib/redis/dedup.test.ts
describe('isDuplicate', () => {
  it('première fois → false (pas duplicate)', async () => { ... });
  it('deuxième fois en TTL → true', async () => { ... });
  it('après TTL expiry → false (recyclé)', async () => { ... });
  it('Redis down → fallback memory + warning log', async () => { ... });
  // ... 8 autres tests
});
```

### Circuit breaker

```ts
// lib/redis/circuit-breaker.test.ts
describe('CircuitBreaker', () => {
  it('CLOSED → trip après N failures consécutifs → OPEN', async () => { ... });
  it('OPEN → après timeout → HALF_OPEN', async () => { ... });
  it('HALF_OPEN → success → CLOSED', async () => { ... });
  it('HALF_OPEN → failure → OPEN reset', async () => { ... });
  it('Redis down → fail-safe CLOSED (allow traffic)', async () => { ... });
  // ... 10 autres tests
});
```

### Chat moderation

```ts
// lib/chat/moderation.test.ts
describe('moderateText', () => {
  it('flag OFF → toujours pass-through (back-compat)', async () => { ... });
  it('flag ON + content safe → flagged=false', async () => { ... });
  it('flag ON + content harassment → flagged=true categories=[harassment]', async () => { ... });
  it('Moderation API timeout → fail-soft (continue avec log)', async () => { ... });
  it('Moderation API 500 → fail-soft', async () => { ... });
  it('input vide → no-op', async () => { ... });
  // ... 4 autres tests
});
```

### Anthropic fallback adapter

```ts
// lib/chat/providers/anthropic.test.ts
describe('AnthropicProvider', () => {
  it('chat() retourne stream compatible OpenAI interface', async () => { ... });
  it('tool calls supportés (compatibility layer)', async () => { ... });
  it('429 rate limit → retry exponentiel ', async () => { ... });
  it('streaming chunks parsing correct', async () => { ... });
  // ... 8 autres tests
});
```

### Retry policy publishing

```ts
// lib/social-publishing/retry-policy.test.ts
describe('retry-policy', () => {
  it('nextRetryAt(0) → +1min', () => { ... });
  it('nextRetryAt(4) → +6h (last backoff)', () => { ... });
  it('nextRetryAt(5) → null (dead letter)', () => { ... });
  it('isDeadLetter(5) → true', () => { ... });
  it('isDeadLetter(4) → false', () => { ... });
  // ... 3 autres tests
});
```

### Event mapper unifié

```ts
// lib/tracking/event-mapper.test.ts
describe('mapEventName', () => {
  it('view_item → ViewContent pour Meta', () => { ... });
  it('view_item → view_item pour GA4', () => { ... });
  it('generate_lead → Lead pour Meta', () => { ... });
  it('event inconnu → null (skip)', () => { ... });
  it('event mapping=skip → null explicite', () => { ... });
  // ... 10 autres tests (matrice events × providers)
});
```

### CAPI batching

```ts
// lib/tracking/server/dispatcher-batch.test.ts
describe('CAPI batch flush', () => {
  it('buffer Redis 50 events → 1 fetch CAPI', async () => { ... });
  it('buffer < 50 → flush quand même', async () => { ... });
  it('fetch fail → re-push events (retry)', async () => { ... });
  it('retry max 5 → drop avec log', async () => { ... });
  it('ordre préservé (FIFO)', async () => { ... });
  // ... 7 autres tests
});
```

---

## Tests integration (MSW)

### MSW handlers à créer

```ts
// src/test/msw/openai-handlers.ts
export const openaiHandlers = [
  // POST /v1/chat/completions
  // POST /v1/moderations
  // Streaming SSE simulé
];

// src/test/msw/anthropic-handlers.ts
export const anthropicHandlers = [
  // POST /v1/messages (streaming)
];

// src/test/msw/meta-capi-handlers.ts
export const metaCapiHandlers = [
  // POST /v22.0/{pixel_id}/events
];

// src/test/msw/postiz-handlers.ts (existant, étendre)
```

### Scénarios d'intégration

```ts
// orchestrator.integration.test.ts
describe('Chat orchestrator — intégration MSW', () => {
  it('Pipeline complet : user → moderation → OpenAI → moderation → réponse', async () => {
    server.use(...openaiHandlers, ...moderationHandlers);
    const response = await sendChat('Bonjour, quel est le pack ?');
    expect(response.text).toContain('Pack FemiGlow');
  });

  it('OpenAI 503 → fallback Anthropic', async () => {
    server.use(rejectOpenAI(503), ...anthropicHandlers);
    const response = await sendChat('Test');
    expect(response.provider).toBe('anthropic');
  });

  it('Both down → message dégradé scripté', async () => {
    server.use(rejectOpenAI(503), rejectAnthropic(503));
    const response = await sendChat('Test');
    expect(response.text).toContain('Je suis temporairement indisponible');
  });

  it('Moderation flagged → message refusé', async () => {
    server.use(...flaggedModerationHandler);
    const response = await sendChat('content offensive');
    expect(response.refused).toBe(true);
    expect(response.text).toContain('ne peux pas répondre à cela');
  });
});

// publishing.integration.test.ts
describe('Publishing — intégration MSW', () => {
  it('Mode now → publish immédiat → success → audit log', async () => { ... });
  it('Mode schedule → row scheduled_jobs créée', async () => { ... });
  it('Cron flush → posts schedulés partent', async () => { ... });
  it('Postiz 500 → retry +1min → success', async () => { ... });
  it('Postiz fail 5x → dead letter + alerte admin', async () => { ... });
  it('Insta carrousel 5 images → all 5 publiées', async () => { ... });
});

// tracking-batch.integration.test.ts
describe('Tracking CAPI batching', () => {
  it('50 events ingest → 1 fetch CAPI Meta', async () => { ... });
  it('Cron flush vide buffer Redis', async () => { ... });
  it('Meta CAPI 503 → events restent en buffer pour retry', async () => { ... });
});
```

**Total tests MSW** : ~30 tests.

---

## Tests E2E (Playwright)

### Tag `@live-chat`

```ts
// e2e/live-chat.spec.ts
test.describe('@live-chat', () => {
  test('utilisateur ouvre widget → envoie message → réponse en < 5s', async ({ page }) => { ... });
  test('message offensant → modéré, message scripté retourné', async ({ page }) => { ... });
  test('OpenAI down (mock) → fallback Anthropic visible', async ({ page }) => { ... });
  test('Lead capture inline → form apparait après 3 messages', async ({ page }) => { ... });
  test('Streaming smooth — chunks arrivent en < 200ms entre chacun', async ({ page }) => { ... });
  test('Multilingue FR/AR → switch fonctionne', async ({ page }) => { ... });
});
```

### Tag `@live-publishing`

```ts
// e2e/live-publishing.spec.ts
test.describe('@live-publishing', () => {
  test('Admin crée post mode now → publié immédiatement', async ({ page }) => { ... });
  test('Admin crée post mode schedule → rdv cron → publié', async ({ page }) => { ... });
  test('Post draft → admin valide → publié', async ({ page }) => { ... });
  test('Carrousel 5 images → toutes visibles dans preview', async ({ page }) => { ... });
  test('Dashboard santé visible dead letter', async ({ page }) => { ... });
});
```

### Tag `@live-tracking`

```ts
// e2e/live-tracking.spec.ts
test.describe('@live-tracking', () => {
  test('page_view ingest → tracking_events_log row apparait', async ({ page, request }) => { ... });
  test('dédup : 2 events même event_id → 1 row seulement', async ({ page, request }) => { ... });
  test('serverFire SSR → row visible en analytics', async ({ page, request }) => { ... });
  test('CAPI batching : 60 events → 2 fetch Meta (batches 50+10)', async ({ page, request }) => { ... });
});
```

**Total E2E Playwright** : ~20 tests.

---

## Smoke tests (production)

### Script 1 — `smoke-chat.ts`

Lance une session chat synthétique :
- POST `/api/chat/start` → session_id
- POST `/api/chat/message` × 3 messages
- Vérifie : 200 OK, streaming OK, contenu non-vide
- Mesure : latence first chunk, latence total
- Exit 1 si < 95% des assertions OK

### Script 2 — `smoke-publishing.ts`

Crée un post test mode `dry_run` :
- POST `/api/content-studio/jobs` → job_id
- Vérifie audit_log entry < 30s
- Status terminal = `published_dryrun`

### Script 3 — `smoke-tracking.ts`

(Existant, étendre) Inclut :
- Verify dédup (POST 2 mêmes events → 1 row)
- Verify batching (50 events → buffer Redis > 0 puis flush)
- Verify serverFire (page SSR → row apparait)

---

## CI gates

```yaml
# .github/workflows/live-systems.yml (conceptuel)
- pnpm test --run live-systems chat-moderation redis tracking-batch
- pnpm e2e --grep "@live-chat|@live-publishing|@live-tracking"
- pnpm tsx scripts/smoke-chat.ts --url http://localhost:3000
- pnpm tsx scripts/smoke-publishing.ts --url http://localhost:3000
- pnpm tsx scripts/smoke-tracking.ts --url http://localhost:3000
```

Tous les gates doivent passer avant merge sur master.

---

## Tests à NE PAS écrire (anti-patterns)

❌ Tests qui mockent `redis.set` à la main — utiliser le mock global d'Upstash
❌ Tests qui dépendent du timing réel (Date.now()) sans vi.useFakeTimers
❌ Tests E2E qui fire de vraies API externes (utiliser MSW)
❌ Tests qui injectent à la main des champs persistés (cf. anti-pattern overview.test.ts identifié dans audit attribution)
