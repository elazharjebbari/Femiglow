# scenario-delivery-4xx

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `attemptDelivery` (worker) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-04 |

## Préconditions
- Une livraison `pending` avec `attempt: 0`.
- Le consommateur externe renvoie `400` (ou `404`, ou `422`).
- Politique : 4xx → considéré comme échec, MAIS retry quand même (l'admin peut corriger côté distant).

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () =>
    HttpResponse.json(
      { error: 'invalid_payload', message: 'channel not found' },
      { status: 404 },
    ),
  ),
];
```

## Action utilisateur

1. Le worker invoque `attemptDelivery`.
2. Le consommateur renvoie `404`.

## Assertions

- `status = 'failed'`, `attempt = 1`, `httpStatus = 404`.
- `responseBody` capture le body distant (tronqué à 4 KB).
- `nextAttemptAt` est défini selon le backoff (60s pour attempt=1).
- Un événement `lead_event` type `webhook_failed` est créé avec `meta.httpStatus = 404`.
- Pas de `dead-letter` à ce stade (le `maxAttempts` n'est pas atteint).
- L'admin voit cette livraison dans `/admin/webhooks/[id]/deliveries?status=failed`.
- Le retry suivra le même cycle (le payload n'est jamais modifié).

## Edge cases couverts ailleurs

- 5xx → `scenario-delivery-5xx.md`
- Timeout → `scenario-delivery-timeout.md`
- Atteinte maxAttempts → `scenario-delivery-final-fail.md`
- Replay manuel après correction → `scenario-delivery-replay.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('attemptDelivery 4xx', () => {
  it('marque failed mais reprogramme un retry', async () => {
    const r = await attemptDelivery({ deliveryId: 'del_4xx' });
    expect(r.status).toBe('failed');
    expect(r.httpStatus).toBe(404);
    expect(r.nextAttemptAt).not.toBeNull();
  });
});
```
