# Custom matchers — assertions domain-specific

Matchers vitest custom pour rendre les assertions **expressives** et **réutilisables**.
Inspiré de `jest-extended` mais ciblé chat.

## 1. Liste exhaustive

| Matcher | Cible | Exemple |
|---------|-------|---------|
| `toBeFromLanguage(lang)` | `ChatMessage` | `expect(msg).toBeFromLanguage('ar-MA')` |
| `toContainSanitizedPII()` | string | `expect(text).toContainSanitizedPII()` |
| `toBeStreamedEventOf(type)` | SSE chunk | `expect(chunk).toBeStreamedEventOf('chunk')` |
| `toHaveEmittedEvent(name)` | event repo | `expect(eventRepo).toHaveEmittedEvent('chat_lead_captured')` |
| `toRespectBudget(name)` | duration ms | `expect(latencyMs).toRespectBudget('first-chunk')` |
| `toBeBlockedByModeration()` | result | `expect(result).toBeBlockedByModeration()` |
| `toHaveOfferedLeadFormWithReason(r)` | result | `expect(orchestratorResult).toHaveOfferedLeadFormWithReason('purchase-intent')` |
| `toBeRedacted(label)` | string | `expect(text).toBeRedacted('phone')` |
| `toFallbackToProvider(name)` | result | `expect(orchestratorResult).toFallbackToProvider('anthropic')` |
| `toMatchIntent(intent, source?)` | result | `expect(result).toMatchIntent('purchase-intent', 'regex')` |
| `toHaveRagSourcesAbove(score)` | result | `expect(result).toHaveRagSourcesAbove(0.7)` |
| `toServeFromCanned()` | result | `expect(result).toServeFromCanned()` |
| `toHaveCircuitBreakerOpen(provider)` | router state | `expect(state).toHaveCircuitBreakerOpen('openai')` |
| `toBeWithinServiceLevel(min, max)` | health | `expect(health).toBeWithinServiceLevel(0, 1)` |
| `toBeRtlLayout()` | DOM | `expect(panel).toBeRtlLayout()` |
| `toBeKeyboardAccessible()` | DOM | `expect(launcher).toBeKeyboardAccessible()` |

## 2. Implémentations

### 2.1 `toBeFromLanguage`

```typescript
// src/test/matchers/chat-language.ts
export const toBeFromLanguage = (received: { language?: string; content?: string }, expected: string) => {
  const lang = received.language;
  if (lang === expected) {
    return { pass: true, message: () => `expected language not to be ${expected}` };
  }
  return {
    pass: false,
    message: () => `expected language to be "${expected}" but got "${lang}". Content: "${received.content?.slice(0, 80) ?? '<no content>'}"`,
  };
};
```

### 2.2 `toBeStreamedEventOf`

```typescript
// src/test/matchers/sse-event.ts
export const toBeStreamedEventOf = (received: string | { event?: string; data?: unknown }, expected: string) => {
  const ev = typeof received === 'string'
    ? received.split('\n').find((l) => l.startsWith('event:'))?.slice(7).trim()
    : received.event;
  if (ev === expected) {
    return { pass: true, message: () => `expected SSE event not to be ${expected}` };
  }
  return {
    pass: false,
    message: () => `expected SSE event "${expected}", got "${ev}". Raw:\n${typeof received === 'string' ? received.slice(0, 200) : JSON.stringify(received).slice(0, 200)}`,
  };
};
```

### 2.3 `toRespectBudget`

```typescript
// src/test/matchers/latency-budget.ts
const BUDGETS_MS: Record<string, number> = {
  'first-chunk': 800,
  'full-reply': 3_000,
  'session-create': 100,
  'feedback-submit': 100,
  'lead-submit': 200,
};

export const toRespectBudget = (received: number, name: keyof typeof BUDGETS_MS) => {
  const budget = BUDGETS_MS[name];
  if (!budget) return { pass: false, message: () => `unknown budget "${name}"` };
  if (received <= budget) {
    return { pass: true, message: () => `expected ${received}ms to exceed budget ${name}=${budget}ms` };
  }
  return {
    pass: false,
    message: () => `latency ${received}ms exceeded budget for "${name}" (${budget}ms)`,
  };
};
```

### 2.4 `toBeRedacted`

```typescript
// src/test/matchers/redaction.ts
const PATTERNS = {
  phone: /\[t[ée]l[ée]phone\]/i,
  email: /\[email\]/i,
  iban: /\[iban\]/i,
  cni: /\[cni\]/i,
};

export const toBeRedacted = (received: string, label: keyof typeof PATTERNS) => {
  const pattern = PATTERNS[label];
  if (!pattern) return { pass: false, message: () => `unknown redaction label "${label}"` };
  if (pattern.test(received)) {
    return { pass: true, message: () => `expected text NOT to contain redacted "${label}"` };
  }
  return {
    pass: false,
    message: () => `expected text to contain redacted "${label}" placeholder, got: "${received.slice(0, 120)}"`,
  };
};
```

### 2.5 `toHaveOfferedLeadFormWithReason`

```typescript
// src/test/matchers/lead-decision.ts
export const toHaveOfferedLeadFormWithReason = (
  received: { leadFormOffered?: boolean; leadFormReason?: string },
  expectedReason: string,
) => {
  if (!received.leadFormOffered) {
    return {
      pass: false,
      message: () => `expected lead form to be offered with reason "${expectedReason}", but was not offered`,
    };
  }
  if (received.leadFormReason !== expectedReason) {
    return {
      pass: false,
      message: () => `expected lead form reason "${expectedReason}", got "${received.leadFormReason}"`,
    };
  }
  return { pass: true, message: () => `expected NOT to offer lead form with reason "${expectedReason}"` };
};
```

### 2.6 `toFallbackToProvider`

```typescript
// src/test/matchers/provider-fallback.ts
export const toFallbackToProvider = (received: { provider?: string; failedProviders?: string[] }, expected: string) => {
  if (received.provider !== expected) {
    return {
      pass: false,
      message: () => `expected fallback provider "${expected}", got "${received.provider}". Failed providers: [${received.failedProviders?.join(', ') ?? ''}]`,
    };
  }
  if (!received.failedProviders?.length) {
    return {
      pass: false,
      message: () => `expected at least one failed provider before fallback to "${expected}"`,
    };
  }
  return { pass: true, message: () => `expected NOT to fallback to "${expected}"` };
};
```

## 3. Registration globale

```typescript
// src/test/matchers/index.ts
import { toBeFromLanguage } from './chat-language';
import { toBeStreamedEventOf } from './sse-event';
import { toRespectBudget } from './latency-budget';
import { toBeRedacted } from './redaction';
import { toHaveOfferedLeadFormWithReason } from './lead-decision';
import { toFallbackToProvider } from './provider-fallback';

export const customMatchers = {
  toBeFromLanguage,
  toBeStreamedEventOf,
  toRespectBudget,
  toBeRedacted,
  toHaveOfferedLeadFormWithReason,
  toFallbackToProvider,
  // ... etc
};
```

```typescript
// src/test/setup/matchers.setup.ts
import { expect } from 'vitest';
import { customMatchers } from '@/test/matchers';
expect.extend(customMatchers);
```

## 4. Types TypeScript

```typescript
// src/test/matchers/types.d.ts
import 'vitest';

interface CustomMatchers<R = unknown> {
  toBeFromLanguage(lang: string): R;
  toBeStreamedEventOf(type: string): R;
  toRespectBudget(name: 'first-chunk' | 'full-reply' | 'session-create' | 'feedback-submit' | 'lead-submit'): R;
  toBeRedacted(label: 'phone' | 'email' | 'iban' | 'cni'): R;
  toHaveOfferedLeadFormWithReason(reason: string): R;
  toFallbackToProvider(provider: string): R;
  // ...
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
```

## 5. Pour Playwright (assertions chainées)

Playwright permet ses propres assertions custom :

```typescript
// e2e/helpers/assertions.ts
import { expect, Locator } from '@playwright/test';

expect.extend({
  async toBeRtlLayout(received: Locator) {
    const direction = await received.evaluate((el) => getComputedStyle(el).direction);
    return {
      pass: direction === 'rtl',
      message: () =>
        direction === 'rtl'
          ? `expected element NOT to be RTL`
          : `expected element to have dir=rtl, got "${direction}"`,
    };
  },
});

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toBeRtlLayout(): R;
    }
  }
}
```

## 6. Examples in context

```typescript
// Tests d'intent
expect(result).toMatchIntent('purchase-intent', 'regex');

// Tests de PII
const sanitized = sanitize('Mon numéro : 06 12 34 56 78');
expect(sanitized.text).toBeRedacted('phone');

// Tests de SSE
const chunk = await readSseChunk();
expect(chunk).toBeStreamedEventOf('chunk');

// Tests de budget
const start = performance.now();
await sendMessage();
expect(performance.now() - start).toRespectBudget('first-chunk');

// Tests de lead decision
const result = await orchestrator.handle({ content: 'je veux acheter' });
expect(result).toHaveOfferedLeadFormWithReason('purchase-intent');

// Tests de fallback
server.use(openaiServerError);
const r2 = await orchestrator.handle({ content: 'salut' });
expect(r2).toFallbackToProvider('anthropic');

// Tests de RTL (Playwright)
const panel = page.getByRole('region', { name: /assistant/i });
await expect(panel).toBeRtlLayout();
```

## 7. Maintenance

- Tout nouveau matcher = test du matcher (`<matcher>.test.ts`) qui couvre les 3 cas :
  - Pass case
  - Fail case
  - Error message lisible
- Documenter dans ce fichier (catalog).
- Versioning : breaking change = renommage + alias deprecated 1 release.
