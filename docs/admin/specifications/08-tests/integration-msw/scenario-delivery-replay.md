# scenario-delivery-replay

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | `dispatch` + replay manuel |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/dispatch.integration.test.ts` |
| Référence | F-WHFLOW-06 |

## Préconditions
- Une livraison `del_dead` en status `dead`, `attempt: 8`.
- L'admin a corrigé la cause distante et clique "Renvoyer" depuis l'UI.
- L'API `POST /api/admin/webhook-deliveries/del_dead/retry` reset l'état.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Côté admin API : reset
  http.post('*/api/admin/webhook-deliveries/del_dead/retry', () =>
    HttpResponse.json({
      id: 'del_dead',
      endpointId: 'wh_slack',
      eventName: 'lead.created',
      status: 'pending',
      attempt: 0,
      maxAttempts: 8,
      scheduledAt: '2026-05-03T16:00:00Z',
      lastAttemptAt: null,
      nextAttemptAt: '2026-05-03T16:00:00Z',
      httpStatus: null,
      durationMs: null,
      responseBody: null,
      idempotencyKey: 'idem_dead',
      signature: 'sha256=re-signed',
      payload: {},
    }),
  ),
  // Côté consommateur : OK cette fois
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', () =>
    HttpResponse.json({ ok: true }),
  ),
];
```

## Action utilisateur

1. L'admin clique "Renvoyer" sur `del_dead` (status `dead`).
2. L'API admin reset `attempt = 0`, `status = 'pending'`.
3. Le cron suivant rejoue la livraison.
4. Le consommateur renvoie `200`.

## Assertions

- Après l'appel API admin : `attempt = 0`, `status = 'pending'`, `nextAttemptAt = NOW`.
- L'`idempotencyKey` est **conservée** (le consommateur peut détecter le doublon s'il a déjà accepté).
- La signature est recalculée (timestamp neuf).
- Après le tick cron, `status = 'delivered'`, `attempt = 1` (compteur reset).
- Un événement `lead_event` type `webhook_sent` est créé avec `meta.replayed = true`.

## Edge cases couverts ailleurs

- Conflit retry sur delivered → `scenario-delivery-retry-conflict.md`
- Échec final → `scenario-delivery-final-fail.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { resetDelivery } from '@/lib/webhooks/dispatch';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('replay manuel', () => {
  it('reset attempt et delivered au prochain essai', async () => {
    const reset = await resetDelivery('del_dead');
    expect(reset.attempt).toBe(0);
    expect(reset.status).toBe('pending');
    const r = await attemptDelivery({ deliveryId: 'del_dead' });
    expect(r.status).toBe('delivered');
    expect(r.attempt).toBe(1);
  });
});
```
