# scenario-delivery-5xx

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `attemptDelivery` (worker) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-02 |

## Préconditions
- Une livraison `pending` avec attempt `0`, `maxAttempts: 8`.
- Le consommateur externe renvoie `503` au premier essai.
- Backoff exponentiel : `delay = 2^attempt * 30s` plafonné à 1h.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

let calls = 0;

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () => {
    calls += 1;
    if (calls === 1) {
      return HttpResponse.json({ error: 'upstream_unavailable' }, { status: 503 });
    }
    return HttpResponse.json({ ok: true }, { status: 200 });
  }),
];
```

## Action utilisateur

1. Le worker invoque `attemptDelivery` (essai 1).
2. Le consommateur renvoie `503`.
3. Plus tard (après backoff), un nouvel essai est lancé.
4. Le consommateur renvoie `200`.

## Assertions

- Après essai 1 : `status = 'failed'` (mais pas terminal), `attempt = 1`, `nextAttemptAt ≈ NOW + 60s` (2¹ × 30s).
- Le worker ne lance **pas** d'autre essai dans la même invocation (le cron s'en charge).
- Après essai 2 : `status = 'delivered'`, `attempt = 2`, `httpStatus = 200`.
- Le payload est strictement identique entre les deux essais (idempotency key conservée).
- La signature est recalculée à chaque essai (timestamp à jour).

## Edge cases couverts ailleurs

- Timeout → `scenario-delivery-timeout.md`
- 4xx → `scenario-delivery-4xx.md`
- Max attempts → `scenario-delivery-final-fail.md`
- Tick batch → `scenario-cron-tick-batch.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('attemptDelivery 5xx puis succès', () => {
  it('schedule un retry après 503 puis delivered au 2e essai', async () => {
    const r1 = await attemptDelivery({ deliveryId: 'del_5xx' });
    expect(r1.status).toBe('failed');
    expect(r1.nextAttemptAt).not.toBeNull();
    const r2 = await attemptDelivery({ deliveryId: 'del_5xx' });
    expect(r2.status).toBe('delivered');
    expect(r2.attempt).toBe(2);
  });
});
```
