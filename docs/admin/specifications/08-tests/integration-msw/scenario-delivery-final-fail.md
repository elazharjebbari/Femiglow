# scenario-delivery-final-fail

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `attemptDelivery` (worker) |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-05 |

## Préconditions
- Une livraison avec `attempt: 7`, `maxAttempts: 8`, status `pending`.
- Le consommateur renvoie systématiquement `500`.
- Cette tentative est la dernière autorisée.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () =>
    HttpResponse.json({ error: 'upstream' }, { status: 500 }),
  ),
];
```

## Action utilisateur

1. Le worker invoque `attemptDelivery` (8e essai).
2. Le consommateur renvoie `500`.

## Assertions

- `status = 'dead'` (terminal, plus aucun retry automatique).
- `attempt = 8`, `nextAttemptAt = null`.
- Un événement `lead_event` type `webhook_failed` est créé avec `meta.final = true`.
- L'endpoint en question conserve son flag `active: true` (pas de désactivation auto).
- Un compteur `failed_24h` est incrémenté côté KPI dashboard.
- L'admin peut encore déclencher un replay manuel (cf. `scenario-delivery-replay.md`).
- Aucune notification automatique (alerting hors scope, à valider produit).

## Edge cases couverts ailleurs

- Replay manuel → `scenario-delivery-replay.md`
- Retry réussi → `scenario-delivery-5xx.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('attemptDelivery dernière tentative', () => {
  it('passe en dead-letter après maxAttempts', async () => {
    const r = await attemptDelivery({ deliveryId: 'del_last' });
    expect(r.status).toBe('dead');
    expect(r.attempt).toBe(8);
    expect(r.nextAttemptAt).toBeNull();
  });
});
```
