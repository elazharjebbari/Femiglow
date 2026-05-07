# scenario-delivery-success

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `attemptDelivery` (worker) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-01 |

## Préconditions
- Une livraison `pending` existe avec attempt `0`.
- Le consommateur externe (mocké via MSW) renvoie `200`.
- L'horloge est figée via `vi.useFakeTimers()` à `2026-05-03T14:32:00Z`.

## Handlers MSW

```ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', async ({ request }) => {
    const sig = request.headers.get('X-FemiGlow-Signature');
    const idem = request.headers.get('X-FemiGlow-Idempotency-Key');
    if (!sig || !idem) {
      return HttpResponse.json({ error: 'missing_headers' }, { status: 400 });
    }
    await delay(150);
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),
];
```

## Action utilisateur

1. Le worker `attemptDelivery({ deliveryId: 'del_001' })` est invoqué.
2. La requête HTTP est émise vers le consommateur.
3. Le consommateur renvoie `200`.

## Assertions

- La requête contient les headers : `X-FemiGlow-Signature`, `X-FemiGlow-Idempotency-Key`, `Content-Type: application/json`.
- La signature est calculée HMAC-SHA256 sur `payload + timestamp` avec le secret de l'endpoint.
- Après succès, `webhook_deliveries.status = 'delivered'`, `attempt = 1`, `lastAttemptAt = NOW()`, `httpStatus = 200`.
- Un événement `lead_event` type `webhook_sent` est créé pour le lead lié.
- Aucun retry n'est programmé (`nextAttemptAt = null`).
- La latence (`durationMs`) est ≈ 150 ms (± 50 ms tolérance).

## Edge cases couverts ailleurs

- 5xx → `scenario-delivery-5xx.md`
- Timeout → `scenario-delivery-timeout.md`
- 4xx → `scenario-delivery-4xx.md`
- Échec final → `scenario-delivery-final-fail.md`

## Notes d'implémentation

```ts
import { describe, it, expect, vi } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('attemptDelivery 200', () => {
  it('marque delivered au premier essai', async () => {
    vi.setSystemTime(new Date('2026-05-03T14:32:00Z'));
    const result = await attemptDelivery({ deliveryId: 'del_001' });
    expect(result.status).toBe('delivered');
    expect(result.attempt).toBe(1);
    expect(result.httpStatus).toBe(200);
  });
});
```
