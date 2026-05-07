# scenario-delivery-timeout

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `attemptDelivery` (worker) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-03 |

## Préconditions
- Une livraison `pending` avec `attempt: 0`.
- Le consommateur ne répond jamais (timeout client = 10 s).
- L'AbortController du fetch timeout après 10 000 ms.

## Handlers MSW

```ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', async () => {
    // Le serveur prend délibérément trop de temps.
    await delay(15_000);
    return HttpResponse.json({ ok: true });
  }),
];
```

## Action utilisateur

1. Le worker invoque `attemptDelivery` avec `timeoutMs: 10_000`.
2. Après 10 s, l'AbortController déclenche `AbortError`.

## Assertions

- L'AbortController abort la requête à 10 000 ms exactement.
- L'erreur est typée `timeout` (pas confondue avec une erreur réseau).
- `webhook_deliveries.status = 'failed'`, `httpStatus = null`, `responseBody = null`.
- `durationMs ≈ 10_000`.
- `nextAttemptAt` est calculé via le backoff (2¹ × 30s = 60s).
- Aucune erreur non capturée n'est propagée (le worker doit être robuste).
- Un événement `lead_event` type `webhook_failed` est créé avec `meta.reason = 'timeout'`.

## Edge cases couverts ailleurs

- 5xx → `scenario-delivery-5xx.md`
- 4xx → `scenario-delivery-4xx.md`
- Échec final → `scenario-delivery-final-fail.md`

## Notes d'implémentation

```ts
import { describe, it, expect, vi } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('attemptDelivery timeout 10s', () => {
  it('abort et marque failed avec reason timeout', async () => {
    vi.useFakeTimers();
    const promise = attemptDelivery({ deliveryId: 'del_timeout', timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(10_001);
    const result = await promise;
    expect(result.status).toBe('failed');
    expect(result.httpStatus).toBeNull();
    expect(result.durationMs).toBeGreaterThanOrEqual(10_000);
    vi.useRealTimers();
  });
});
```
