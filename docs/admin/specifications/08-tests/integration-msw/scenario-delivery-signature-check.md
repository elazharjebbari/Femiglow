# scenario-delivery-signature-check

| Aspect | Valeur |
|---|---|
| Domaine | webhook-engine |
| Composant | consommateur externe (mocké) qui vérifie HMAC |
| Niveau | intégration MSW |
| Fichier test | `apps/web/src/lib/webhooks/__tests__/attempt-delivery.integration.test.ts` |
| Référence | F-WHFLOW-01 (variante sécurité) |

## Préconditions
- Une livraison `pending`, secret `whsec_correct`.
- Le consommateur (mocké) vérifie la signature HMAC-SHA256 et rejette si invalide.

## Handlers MSW

```ts
import { http, HttpResponse } from 'msw';
import crypto from 'node:crypto';

const SECRET = 'whsec_correct';

export const handlers = [
  http.post('https://hooks.slack.com/services/T0/B0/XXXX', async ({ request }) => {
    const sig = request.headers.get('X-FemiGlow-Signature') ?? '';
    const ts = request.headers.get('X-FemiGlow-Timestamp') ?? '';
    const raw = await request.text();
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${ts}.${raw}`)
      .digest('hex');
    if (sig !== `sha256=${expected}`) {
      return HttpResponse.json(
        { error: 'invalid_signature' },
        { status: 401 },
      );
    }
    return HttpResponse.json({ ok: true });
  }),
];
```

## Action utilisateur

1. Le worker invoque `attemptDelivery` avec le secret `whsec_correct` → succès.
2. Variante : le worker utilise `whsec_wrong` (ex. après rotation côté serveur sans MAJ consommateur).

## Assertions

### Cas signature valide
- Headers envoyés : `X-FemiGlow-Signature: sha256=...`, `X-FemiGlow-Timestamp: <unix>`.
- Le consommateur recompute la signature avec son secret partagé et renvoie `200`.
- `webhook_deliveries.status = 'delivered'`.

### Cas signature invalide (mauvais secret côté livreur)
- Le consommateur renvoie `401 invalid_signature`.
- `webhook_deliveries.status = 'failed'`, `httpStatus = 401`.
- Le retry sera tenté quand même (politique 4xx, cf. `scenario-delivery-4xx.md`).
- L'admin doit régénérer ou resynchroniser le secret côté consommateur.

## Edge cases couverts ailleurs

- Rotation secret côté admin → `scenario-webhook-rotate.md`
- 4xx générique → `scenario-delivery-4xx.md`
- Replay après correction → `scenario-delivery-replay.md`

## Notes d'implémentation

```ts
import { describe, it, expect } from 'vitest';
import { attemptDelivery } from '@/lib/webhooks/attempt-delivery';

describe('vérification signature consommateur', () => {
  it('delivered avec le bon secret', async () => {
    const r = await attemptDelivery({ deliveryId: 'del_signed', secretOverride: 'whsec_correct' });
    expect(r.status).toBe('delivered');
  });

  it('401 si mauvais secret', async () => {
    const r = await attemptDelivery({ deliveryId: 'del_signed', secretOverride: 'whsec_wrong' });
    expect(r.status).toBe('failed');
    expect(r.httpStatus).toBe(401);
  });
});
```
