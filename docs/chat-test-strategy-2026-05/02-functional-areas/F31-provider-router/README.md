# F31 — Provider router + circuit breaker

## 1. Description

### Cible
Sélectionner le provider LLM optimal selon : priorité role (chat/embedding/moderation),
état breaker (CLOSED/OPEN/HALF-OPEN), quota mensuel disponible, allowlist tools (futur).

### États du breaker
| État | Critère d'entrée | Comportement |
|------|------------------|---------------|
| CLOSED | failures < 3 dans 30 s | Provider sélectionnable |
| OPEN | 3 failures consécutifs / 30 s | Provider skip immédiat, cooldown 60 s |
| HALF-OPEN | OPEN + 60 s écoulés | 1 tentative ; succès→CLOSED, échec→OPEN |

### Storage breaker
- **Memory** (per process) — rapide mais pas partagé multi-lambda
- **Redis** (shared) — source of truth multi-lambda
- **Default** : memory ; Redis activé via flag `REDIS_CIRCUIT_BREAKER_ENABLED`

### Risques audit
- **C3** — Fallback 5 niveaux non implémenté (test cible level 0/1, signale absence 2-4)
- **C6** — Race memory↔Redis (test concurrent)
- **I5** — `provider-router.ts` sans tests (combler le gap)

## 2. Tests proposés (~20 cas)

### Unit — Sélection nominale
```typescript
describe('providerRouter.choose', () => {
  it('returns highest priority provider for role chat', async () => {
    seedProviders([
      providerFactory.openai({ priority: 1, role: 'chat' }),
      providerFactory.anthropic({ priority: 2, role: 'chat' }),
    ]);
    const r = await providerRouter.choose('chat');
    expect(r.kind).toBe('openai');
  });

  it('falls back to next priority when primary breaker OPEN', async () => {
    seedProviders([
      providerFactory.openai({ priority: 1, role: 'chat' }),
      providerFactory.anthropic({ priority: 2, role: 'chat' }),
    ]);
    breaker.markOpen('openai');
    const r = await providerRouter.choose('chat');
    expect(r.kind).toBe('anthropic');
  });

  it('throws when ALL providers have breaker OPEN', async () => {
    seedProviders([providerFactory.openai({ role: 'chat' })]);
    breaker.markOpen('openai');
    await expect(providerRouter.choose('chat')).rejects.toThrow(/no_provider_available/);
    // NOTE: futur ADR-004 — devrait retourner un fallback "canned-only" plutôt que throw
  });

  it('skips provider with quota exceeded', async () => {
    seedProviders([
      providerFactory.openai({ priority: 1, role: 'chat', quotaUsedEur: 100, quotaMonthlyEur: 100 }),
      providerFactory.anthropic({ priority: 2, role: 'chat', quotaUsedEur: 0 }),
    ]);
    const r = await providerRouter.choose('chat');
    expect(r.kind).toBe('anthropic');
  });
});
```

### Unit — Breaker logic
```typescript
describe('CircuitBreaker', () => {
  it('opens after 3 failures in 30s', () => {
    const b = new CircuitBreaker('openai');
    b.recordFailure();
    b.recordFailure();
    expect(b.isOpen()).toBe(false);
    b.recordFailure();
    expect(b.isOpen()).toBe(true);
  });

  it('half-opens after cooldown', () => {
    vi.useFakeTimers();
    const b = new CircuitBreaker('openai');
    for (let i = 0; i < 3; i++) b.recordFailure();
    expect(b.isOpen()).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(b.state).toBe('HALF_OPEN');
  });

  it('closes after success in HALF_OPEN', () => {
    const b = new CircuitBreaker('openai');
    b.transitionTo('HALF_OPEN');
    b.recordSuccess();
    expect(b.state).toBe('CLOSED');
  });

  it('re-opens after failure in HALF_OPEN', () => {
    const b = new CircuitBreaker('openai');
    b.transitionTo('HALF_OPEN');
    b.recordFailure();
    expect(b.state).toBe('OPEN');
  });
});
```

### Integration — Multi-lambda race (C6)
```typescript
it('REGRESSION C6 — Redis is source of truth in concurrent flag-on', async () => {
  process.env.REDIS_CIRCUIT_BREAKER_ENABLED = 'true';
  const router1 = new ProviderRouter(); // simulate process 1
  const router2 = new ProviderRouter(); // simulate process 2

  // Process 1 records 3 failures (opens breaker)
  for (let i = 0; i < 3; i++) router1.recordFailure('openai');
  await new Promise((r) => setTimeout(r, 100)); // wait Redis sync

  // Process 2 should see breaker OPEN
  expect(await router2.isOpenAsync('openai')).toBe(true);
});

it('REGRESSION C6 — handles Redis down gracefully (falls back to memory)', async () => {
  // Mock Redis client throw
  vi.mock('@/lib/redis/client', () => ({
    getRedis: () => ({ get: vi.fn().mockRejectedValue(new Error('Redis down')) }),
  }));

  const router = new ProviderRouter();
  router.recordFailure('openai');
  router.recordFailure('openai');
  router.recordFailure('openai');

  // memory state still works
  expect(router.isOpenMemory('openai')).toBe(true);
});
```

### Integration — Multi-provider fallback chain (level 1 ADR-004)
```typescript
it('falls back openai → anthropic → gemini in priority order', async () => {
  server.use(openaiServerError, anthropicServerError);
  const r = await orchestrator.handle({ sessionId, content: 'hi' });
  expect(r).toFallbackToProvider('gemini');
});
```

### Test négatif documenté — levels 2/3/4 absents (C3)
```typescript
it.fails('FUTURE ADR-004 — level 2 RAG_ONLY when all chat providers down', async () => {
  // TODO: implement after C3 fix
});
it.fails('FUTURE ADR-004 — level 3 CANNED_ONLY when budget exhausted', async () => {});
it.fails('FUTURE ADR-004 — level 4 STATIC when DB down', async () => {});
```

## 3. Test matrix
20 cas (voir [test-matrix.csv](test-matrix.csv)).

## 4. Risques audit
- C3 (test signale absence)
- C6 (test régression concurrent)
- I5 (couverture)
- M5 (perte fails Redis async)

## Métadonnées
- Owner: Backend
- Priorité: P0
