# Phase 2 — Couverture P0 components + a11y

**Durée** : 2 semaines (10 jours)

Couvre les composants UI critiques : widget visiteur (F01–F13 P0/P1) et premières routes
API (F14–F22).

## Semaine 4 — Widget visiteur (composants UI)

| Jour | Feature | Tests | A11y | Risque audit |
|------|---------|-------|------|---------------|
| 16 | F01 widget-init (lazy + portal + flag) | 12 component | jest-axe + screen reader | I8 |
| 17 | F02 launcher toggle + F04 composer + F05 message bubble | 24 component | a11y full | — |
| 18 | F08 SSE streaming (use-chat-send hook) | 14 component | — | C5, R5 |
| 19 | F11 lead form bubble (form + validation + submit) | 16 component | a11y form | — |
| 20 | F10 canned suggestions + F07 feedback thumbs | 11 component | a11y interactive | I3 |

**Gate semaine 4** :
- Coverage components P0 ≥ 80 %
- jest-axe violations critiques sur F01, F02, F08, F11 = 0
- All hooks tests pass

## Semaine 5 — Routes API + admin essentiels

| Jour | Feature | Tests | Risque audit |
|------|---------|-------|--------------|
| 21 | F14 POST session + F16 POST forget | 22 integration | F54 RGPD |
| 22 | F15 POST message (orchestrator integration) | 20 integration | C2, C5, C6, R5 + I4 |
| 23 | F22 POST lead/contact + F21 GET canned-pair | 23 integration | — |
| 24 | F17 GET health + F18 POST feedback | 15 integration | — |
| 25 | F40 admin leads (UI + outcome + CSV) | 18 component | I1, audit 2026-05-17 |

**Gate sortie Phase 2** :
- Coverage routes API P0 ≥ 90 %
- Coverage components P0 ≥ 80 %
- 0 flaky en CI sur 14 jours
- A11y critique = 0 sur widget visiteur entier

## Patterns à appliquer

### Component test — template

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';

describe('<MyComponent />', () => {
  beforeEach(() => {
    // MSW handlers setup
  });

  it('renders happy path', () => {});
  it('handles empty state', () => {});
  it('handles loading state', () => {});
  it('handles error state', () => {});
  it('handles interaction (click/type/submit)', async () => {});
  it('handles keyboard navigation', async () => {});
  it('handles edge case (long input, special chars, etc.)', () => {});
  it('@a11y passes axe', async () => {
    const { container } = render(<MyComponent />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
```

### Integration test — template

```typescript
import { beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDb, resetTestDb, teardownTestDb } from '@/test/db/test-db';

beforeAll(async () => { await getTestDb(); });
afterAll(async () => { await teardownTestDb(); });
beforeEach(async () => { await resetTestDb(); });

describe('POST /api/chat/X — integration', () => {
  it('happy path', async () => {});
  it('validation 422', async () => {});
  it('auth 401', async () => {});
  it('rate limit 429', async () => {});
  it('side effects DB + webhooks', async () => {});
});
```

## Patterns anti-flakiness

- Toujours `findBy*` après async action
- Setup faker seed à `42` (déjà fait dans vitest.setup.ts)
- `vi.useFakeTimers()` quand dépendance temps
- MSW `onUnhandledRequest: 'error'`
- `beforeEach` reset MSW handlers et DB state

## Livrables phase 2

- Suite component vitest : ~80 tests
- Suite integration vitest : ~50 tests
- Coverage delta = +25 pts vs baseline
- A11y report jest-axe par feature

## Embeddings dans CI

```yaml
# .github/workflows/test.yml
- name: Test components
  run: pnpm test:components --reporter dot --coverage
- name: A11y critical check
  run: |
    pnpm test:a11y --reporter json --outputFile a11y-report.json
    node scripts/check-a11y-critical.mjs a11y-report.json  # fail si critical > 0
```
