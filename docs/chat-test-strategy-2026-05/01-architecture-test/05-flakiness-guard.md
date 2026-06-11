# Anti-flakiness — règles de survie

> **Définition** : un test flaky = un test qui passe parfois et échoue parfois, **sans
> changement de code**. C'est un cancer pour la confiance dans la CI.

**Politique** : zéro tolérance. Un test flaky → quarantaine immédiate + ticket assigné.

## 1. Causes principales (et leurs traitements)

### 1.1 Timing — race conditions

| Symptôme | Cause | Remède |
|----------|-------|--------|
| `expect(...).toBeVisible()` fail aléatoire | DOM pas encore monté | `await findByRole(...)` qui attend |
| `setTimeout` dans le test | Hack pour attendre | Remplacer par `waitFor` / `expect.poll` |
| Stream pas complet | Lecture trop précoce | Attendre `event: end` |
| Animation interfère | CSS transitions | `motion-reduce` ou désactiver dans test |

**Règle d'or** : **jamais de `waitForTimeout(...)`**. Utiliser :
- `findBy*` (RTL) / `getByRole(...).waitFor()` (Playwright)
- `expect.poll(() => state, { interval: 50, timeout: 5_000 }).toBe(...)`
- `page.waitForResponse((r) => r.url().includes('/api/chat/message') && r.status() === 200)`
- `page.waitForFunction(() => window.__chatStreamComplete)`

### 1.2 Ordre des tests

| Symptôme | Cause | Remède |
|----------|-------|--------|
| Test passe seul mais échoue en suite | State partagé entre tests | `beforeEach` reset + factory immutable |
| Test passe en local, échoue CI | Parallélisme expose race | Marquer `test.serial` ou refactor |
| Test passe avec certains tests, pas avec autres | Ordre dépendant | `sequence.shuffle: true` dans config |

**Règle** : `sequence: { shuffle: true, seed: 42 }` dans `vitest.config.ts` — force la
détection précoce.

### 1.3 Réseau

| Symptôme | Cause | Remède |
|----------|-------|--------|
| MSW miss → real network call | Handler manquant | `onUnhandledRequest: 'error'` |
| MSW slow | Default handlers absents | Précharger via `setupServer` |
| E2E network real | Pas d'isolement | Playwright `page.route` ou backend mock |

### 1.4 Date / Time / Random

| Symptôme | Cause | Remède |
|----------|-------|--------|
| Tests passent jusqu'à minuit | `new Date()` réel | `vi.useFakeTimers({ now: '2026-05-25T10:00:00Z' })` |
| `faker.X()` produit différent | Pas de seed | `faker.seed(42)` global |
| UUID différents entre runs | `crypto.randomUUID()` | Inject `idGenerator` factory |

### 1.5 Animations / cadence

Le chat utilise `humanize.client` qui ajoute 30-50 ms de jitter par chunk. En test :

```typescript
// Stub humanize en test
vi.mock('@/components/chat/humanize.client', () => ({
  humanizeStream: async function* (stream) {
    for await (const chunk of stream) yield chunk; // pas de jitter
  },
}));
```

Ou via flag : `process.env.NEXT_PUBLIC_TEST_MODE === 'true'` désactive humanize.

### 1.6 Concurrence DB

| Symptôme | Cause | Remède |
|----------|-------|--------|
| Test integration parfois fail "duplicate key" | TRUNCATE pas complet | Cascade explicit |
| Tests integration partagent rows | Transactions non rollback | `BEGIN/ROLLBACK` per test |
| Timeouts query | Connexion saturée | Limit pool size en test |

### 1.7 Resources externes

Webhooks, Slack, etc. → **toujours MSW** en test (pas d'URL real).

## 2. Pattern de retry

Playwright autorise 1 retry **uniquement** en CI, **uniquement** pour erreurs réseau :

```typescript
// playwright.config.ts
retries: process.env.CI ? 1 : 0,
```

Un test qui passe après retry **n'est pas considéré comme passing** durablement → review
post-mortem.

Vitest **n'a pas de retry** intentionnellement. Si un test vitest doit retry, c'est qu'il
y a un problème de design.

## 3. Détection de flakiness

### 3.1 Outil — rerun N fois

```bash
# Vitest
pnpm test -- --run --repeat 10 src/lib/chat/services/intent.test.ts

# Playwright
pnpm exec playwright test --repeat-each 10 e2e/chat-visitor-conversation.spec.ts
```

CI hebdo : rerun les specs `@critical` 10× ; tout fail = quarantaine.

### 3.2 Suivi des flaky en CI

GitHub Actions step :

```yaml
- name: Detect flaky tests
  run: |
    pnpm test --reporter=json > test-results.json
    node scripts/detect-flaky.mjs  # parse + alert si retry-passed > 0
```

## 4. Quarantaine

Tag `@flaky-quarantine` :

```typescript
test('@flaky-quarantine streaming receives all chunks', async ({ page }) => {
  // ticket CHA-FLAKY-12
});
```

```typescript
// e2e/.playwright-tags.ts
const QUARANTINE_TAG = '@flaky-quarantine';
// Quotidien : exclude
// Hebdo : run + report
```

Règle : **un test en quarantaine = ticket assigné + deadline 2 semaines**. Pas de
quarantaine permanente.

## 5. Helpers anti-flakiness

### 5.1 `waitForChatStreamComplete` (E2E)

```typescript
// e2e/helpers/wait-for-stream.ts
export async function waitForChatStreamComplete(page: Page, opts = { timeout: 30_000 }) {
  await page.waitForFunction(
    () => {
      const state = (window as any).__chatStoreState?.();
      return state?.isSending === false && state?.lastMessageRole === 'assistant';
    },
    { timeout: opts.timeout },
  );
}
```

Avec un hook côté `chat-store.ts` qui expose `window.__chatStoreState` en mode test.

### 5.2 `awaitNetworkIdle`

```typescript
// e2e/helpers/await-network-idle.ts
export async function awaitNetworkIdle(page: Page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 10_000 });
  // pause supplémentaire pour micro-tasks
  await page.waitForTimeout(ms);
}
```

### 5.3 `pollUntil`

```typescript
// e2e/helpers/poll-until.ts
export async function pollUntil<T>(
  fn: () => T | Promise<T>,
  predicate: (v: T) => boolean,
  opts = { interval: 100, timeout: 5_000 },
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < opts.timeout) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, opts.interval));
  }
  throw new Error('pollUntil timeout');
}
```

## 6. Vérifications pre-merge

CI bloque la PR si :

| Condition | Action |
|-----------|--------|
| Coverage descend > 1 % vs base | Commenter + bloquer |
| Test marqué `.only` ou `.focus` | Bloquer |
| Nouveau `waitForTimeout(...)` introduit | Warning fort |
| Nouveau `@flaky-quarantine` sans ticket | Bloquer |
| Run même test 3× consécutif différent résultat | Bloquer (flaky probable) |

## 7. Bonnes pratiques expressives

```typescript
// ❌ FLAKY
await page.click('button.send');
await page.waitForTimeout(2000);
const msg = await page.textContent('.last-msg');
expect(msg).toContain('Bonjour');

// ✅ ROBUST
await widget.sendMessage('Salut');
await widget.waitForAssistantReply();
const msg = await widget.lastAssistantMessage().textContent();
expect(msg).toContain('Bonjour');
```

```typescript
// ❌ FLAKY (state shared)
let session: ChatSession;
beforeAll(() => { session = chatSessionFactory.build(); });

// ✅ ROBUST
beforeEach(() => {
  session = chatSessionFactory.build(); // fresh per test
});
```

## 8. Anti-patterns spécifiques au chat

### 8.1 Streaming SSE — patterns flaky communs

```typescript
// ❌ FLAKY — read chunks before connection established
const chunks = [];
for await (const chunk of stream) chunks.push(chunk);
expect(chunks).toEqual(...); // peut être incomplet

// ✅ ROBUST — wait end event explicitly
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
  if (chunk.event === 'end') break;
}
```

### 8.2 Tests humanize jitter

```typescript
// ❌ FLAKY — assertion sur timing exact
const start = Date.now();
await humanizeStream(chunks);
expect(Date.now() - start).toBeGreaterThan(150); // 30ms × 5 = 150 — race

// ✅ ROBUST — assertion sur fourchette + tolerance
const elapsed = Date.now() - start;
expect(elapsed).toBeGreaterThanOrEqual(120);
expect(elapsed).toBeLessThanOrEqual(300);
```

### 8.3 Tests DB integration

```typescript
// ❌ FLAKY — pas de cleanup explicite, ordre dépendant
it('inserts session', async () => {
  await db.insert(chatSession).values({...});
  expect(await db.select().from(chatSession)).toHaveLength(1); // fail si autre test a inséré
});

// ✅ ROBUST
beforeEach(() => resetTestDb()); // TRUNCATE
it('inserts session', async () => {
  await db.insert(chatSession).values({...});
  expect(await db.select().from(chatSession)).toHaveLength(1);
});
```

## 9. Reporting & métriques

Quotidien (cf. [05-runbook/04-coverage-monitoring.md](../05-runbook/04-coverage-monitoring.md)) :

| Métrique | Cible | Action si dépassé |
|----------|-------|-------------------|
| Flaky rate (specs en quarantaine / total) | < 1 % | Stand-up dédié |
| Retry-passed rate (CI) | < 0,5 % | Investigate top retry-passed specs |
| Tests >10 s durée avg | 0 | Refactor / move couche |
| Tests >30 s durée P95 | 0 | Idem |

## 10. Audit hebdo

Une fois / semaine, équipe QA :
1. Lit le rapport flaky
2. Décide quarantaine vs fix immédiat
3. Update le doc (ce fichier) si nouveau pattern découvert
4. Communiquer en stand-up

**Ressource recommandée** : Martin Fowler — *Eradicating Non-Determinism in Tests*
(2011, toujours pertinent).
