# Vitest Unit plan

## Modules × tests

| Module | Tests | Fichier |
|--------|-------|---------|
| state-machine.ts | 22 | `state-machine.test.ts` |
| retry.ts | 10 | `retry.test.ts` |
| errors.ts | 14 | `errors.test.ts` |
| repository.ts (idempotency partie) | 6 | `repository.test.ts` (étendre) |
| adapters/postiz.ts | 18 | `adapters/postiz.test.ts` |
| adapters/dry-run.ts | 8 | `adapters/dry-run.test.ts` |
| worker.ts | 10 | `worker.test.ts` |
| alerts.ts | 6 | `alerts.test.ts` |
| weekly-failure-digest.ts | 5 | `weekly-failure-digest.test.ts` |
| postiz.ts (client) | 18 | `lib/content-studio/postiz.test.ts` |
| **Total** | **117 tests** | |

## Pattern unit

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('exp backoff [100, 300, 900]', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(transient503())
      .mockRejectedValueOnce(transient503())
      .mockResolvedValueOnce({ ok: true });

    const p = withRetry(fn, { maxAttempts: 3 });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(300);
    const result = await p;
    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
```

## Property-based (optionnel)

Pour state-machine, utiliser fast-check pour générer des séquences arbitraires et valider :
- Aucune transition invalide n'est jamais permise
- published et cancelled sont toujours terminaux
- Tout état retourne à queued via retry (si failed)

## Commande
```bash
pnpm vitest run src/lib/social-publishing src/lib/content-studio/postiz.test.ts
```
